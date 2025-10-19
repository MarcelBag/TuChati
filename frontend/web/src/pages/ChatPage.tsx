// src/pages/ChatPage.tsx
import React from 'react'
import { useNavigate, useMatch, Outlet } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { ChatRoom as Room, DirectChatRequest } from '../types'
import DirectMessageModal from '../components/Chat/DirectMessageModal'
import { createDirectRequest, decideDirectRequest, fetchDirectRequests, fetchUserProfile, searchUsers } from '../api/chatActions'
import UserProfileModal from '../components/Chat/UserProfileModal'
import AvatarBubble from '../shared/AvatarBubble'
import { useTranslation } from 'react-i18next'
import './ChatPage.css'

export default function ChatPage() {
  const { token, user: currentUser } = useAuth() as any
  const { t } = useTranslation()
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeFilter, setActiveFilter] = React.useState<'all'|'unread'|'favorites'|'groups'>('all')
  const [directRequests, setDirectRequests] = React.useState<{ incoming: DirectChatRequest[]; outgoing: DirectChatRequest[] }>({ incoming: [], outgoing: [] })
  const [requestLoading, setRequestLoading] = React.useState(false)
  const [dmOpen, setDmOpen] = React.useState(false)
  const [dmUsers, setDmUsers] = React.useState<Array<{ id: string; username: string; name?: string; email?: string; avatar?: string | null }>>([])
  const [dmLoading, setDmLoading] = React.useState(false)
  const [dmSubmitting, setDmSubmitting] = React.useState(false)
  const [dmSelected, setDmSelected] = React.useState<string | null>(null)
  const [dmMessage, setDmMessage] = React.useState('')
  const [profileViewer, setProfileViewer] = React.useState<{ open: boolean; loading: boolean; profile: any; target: string | null; error: string | null }>({ open: false, loading: false, profile: null, target: null, error: null })
  const myId = React.useMemo(() => (currentUser?.id != null ? String(currentUser.id) : ''), [currentUser?.id])
  const navigate = useNavigate()

  // is a room open?
  const match = useMatch('/chat/:roomId')
  const hasRoomOpen = !!match
  const currentRoomId = match?.params.roomId

  const loadRooms = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const r = await apiFetch('/api/chat/rooms/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = r.ok ? await r.json() : []
      setRooms(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    if (!token) return
    void loadRooms()
  }, [loadRooms, token])

  const createRoom = async (name: string, is_group = true) => {
    const nm = name.trim()
    if (!nm) return
    const r = await apiFetch('/api/chat/rooms/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: nm, is_group }),
    })
    if (!r.ok) return
    const room = await r.json()
    setRooms(prev => [room, ...prev])
    navigate(`/chat/${room.id}`)
  }

  const loadDirectRequests = React.useCallback(async () => {
    if (!token) return
    setRequestLoading(true)
    try {
      const data = await fetchDirectRequests()
      setDirectRequests({
        incoming: Array.isArray(data?.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data?.outgoing) ? data.outgoing : [],
      })
    } catch {
      setDirectRequests({ incoming: [], outgoing: [] })
    } finally {
      setRequestLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    if (!token) return
    void loadDirectRequests()
  }, [loadDirectRequests, token])

  function formatDate(dateString?: string) {
    if (!dateString) return ''
    const d = new Date(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === yesterday.toDateString()) return t('chatPage.dates.yesterday')
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // SAFELY render last message preview (avoid objects causing React crash)
  function preview(room: any): string {
    // common fields we may get from the API
    const lm = room?.last_message
    if (typeof lm === 'string') return lm
    if (lm && typeof lm === 'object') {
      return lm.content || lm.text || t('chatPage.preview.attachment')
    }
    // other possible server fields
    return (
      room?.last_message_text
      || room?.last_text
      || (room?.is_group ? t('chatPage.preview.groupChat') : t('chatPage.preview.directChat'))
    )
  }

  const openDirectModal = React.useCallback(() => {
    setDmUsers([])
    setDmSelected(null)
    setDmMessage('')
    setDmOpen(true)
    console.debug('[UI] Direct modal open state set to true')
  }, [])

  const closeDirectModal = React.useCallback(() => {
    setDmOpen(false)
    setDmLoading(false)
    setDmSubmitting(false)
    setDmUsers([])
    setDmSelected(null)
    setDmMessage('')
  }, [])

  const handleDirectSearch = React.useCallback((query: string) => {
    if (!dmOpen) return
    if (!query) {
      setDmUsers([])
      return
    }
    setDmLoading(true)
    searchUsers(query)
      .then((results) => {
        const rows = Array.isArray(results) ? results : []
        setDmUsers(rows.map((item: any) => ({
          id: String(item.id ?? item.username ?? Math.random()),
          username: item.username,
          name: item.name,
          email: item.email,
          avatar: item.avatar,
        })).filter((user) => user.username && String(user.id) !== String(currentUser?.id)))
      })
      .catch(() => setDmUsers([]))
      .finally(() => setDmLoading(false))
  }, [currentUser?.id, dmOpen])

  const handleDirectSubmit = React.useCallback(async () => {
    if (!dmSelected) {
      alert(t('chatPage.alerts.chooseUser'))
      return
    }
    setDmSubmitting(true)
    try {
      const data = await createDirectRequest(dmSelected, dmMessage)
      await loadDirectRequests()
      if (data?.status === 'accepted' && data?.room?.id) {
        await loadRooms()
        navigate(`/chat/${data.room.id}`)
      } else {
        alert(t('chatPage.alerts.requestPending'))
      }
      closeDirectModal()
    } catch (error: any) {
      alert(error?.message || t('chatPage.alerts.unableStart'))
    } finally {
      setDmSubmitting(false)
    }
  }, [closeDirectModal, dmMessage, dmSelected, loadDirectRequests, loadRooms, navigate])

  const handleDirectDecision = React.useCallback(async (requestId: string, decision: 'accept' | 'decline') => {
    try {
      const response = await decideDirectRequest(requestId, decision)
      await loadDirectRequests()
      if (decision === 'accept' && response?.room?.id) {
        await loadRooms()
        navigate(`/chat/${response.room.id}`)
      }
    } catch (error: any) {
      alert(error?.message || t('chatPage.alerts.unableUpdate'))
    }
  }, [loadDirectRequests, loadRooms, navigate])

  const updateRoomUnread = React.useCallback((roomId: string | number, unread: number) => {
    setRooms(prev => prev.map(room => {
      if (String(room.id) !== String(roomId)) return room
      return { ...room, unread_count: unread }
    }))
  }, [])

  const openUserProfile = React.useCallback((identifier: string) => {
    if (!identifier) return
    const target = String(identifier)
    setProfileViewer({ open: true, loading: true, profile: null, target, error: null })
    fetchUserProfile(target)
      .then((data) => {
        setProfileViewer(prev => (prev.target === target ? { ...prev, loading: false, profile: data, error: null } : prev))
      })
      .catch((error: any) => {
        setProfileViewer(prev => (prev.target === target ? { ...prev, loading: false, error: error?.message || t('chatPage.alerts.unableProfile') } : prev))
      })
  }, [])

  const closeUserProfile = React.useCallback(() => {
    setProfileViewer({ open: false, loading: false, profile: null, target: null, error: null })
  }, [])

  return (
    <div className="chat-shell">
      {/* Rooms (always visible on desktop) */}
      <aside className="rooms">
        <header className="rooms-hd">
          <h2>{t('chatPage.rooms.title')}</h2>
          <div className="rooms-actions">
            <button
              className="btn small"
              onClick={() => {
                const name = prompt(t('chatPage.rooms.prompt'))
                if (name) createRoom(name)
              }}
            >
              {t('chatPage.rooms.newRoom')}
            </button>
            <button
              className="btn small secondary"
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openDirectModal()
              }}
            >
              {t('chatPage.rooms.directRoom')}
            </button>
          </div>
        </header>

        <div className="rooms-search">
          <input name="room-search" placeholder={t('chatPage.rooms.searchPlaceholder') || undefined} />
        </div>

        <div className="rooms-filters">
          {(['all','unread','favorites','groups'] as const).map(k => (
            <button
              key={k}
              className={`filter-tab ${activeFilter === k ? 'active' : ''}`}
              onClick={() => setActiveFilter(k)}
            >
              {t(`chatPage.filters.${k}`)}
            </button>
          ))}
        </div>

        {requestLoading && <div className="direct-requests"><p className="hint">{t('chatPage.requests.loading')}</p></div>}
        {!requestLoading && (directRequests.incoming.length > 0 || directRequests.outgoing.length > 0) && (
          <div className="direct-requests">
            {directRequests.incoming.length > 0 && (
              <div className="direct-section">
                <h4>{t('chatPage.requests.incoming')}</h4>
                <ul>
                  {directRequests.incoming.map(req => (
                    <li key={req.id}>
                      <div className="direct-meta">
                        <AvatarBubble
                          src={(req.from_user as any)?.avatar}
                          name={req.from_user.name || req.from_user.username}
                          initials={(req.from_user.name || req.from_user.username || 'U').slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <div className="direct-meta-text">
                          <strong>{req.from_user.name || req.from_user.username}</strong>
                          <span className="direct-meta-time">{new Date(req.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {req.initial_message && <p className="direct-message">{req.initial_message}</p>}
                      <div className="direct-actions">
                        <button type="button" onClick={() => handleDirectDecision(req.id, 'accept')}>{t('chatPage.requests.accept')}</button>
                        <button type="button" onClick={() => handleDirectDecision(req.id, 'decline')}>{t('chatPage.requests.decline')}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {directRequests.outgoing.length > 0 && (
              <div className="direct-section">
                <h4>{t('chatPage.requests.outgoing')}</h4>
                <ul>
                  {directRequests.outgoing.map(req => (
                    <li key={req.id}>
                      <div className="direct-meta">
                        <AvatarBubble
                          src={(req.to_user as any)?.avatar}
                          name={req.to_user.name || req.to_user.username}
                          initials={(req.to_user.name || req.to_user.username || 'U').slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <div className="direct-meta-text">
                          <strong>{req.to_user.name || req.to_user.username}</strong>
                          <span className="direct-meta-time">{new Date(req.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {req.initial_message && <p className="direct-message">{req.initial_message}</p>}
                      <span className="direct-status">{t('chatPage.requests.waiting')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <ul className="rooms-list">
          {loading && <li className="hint">{t('chatPage.rooms.loading')}</li>}
          {!loading && rooms.length === 0 && <li className="hint">{t('chatPage.rooms.empty')}</li>}
          {rooms.map(r => {
            const members = (r?.members || (r as any)?.participants || []) as any[]
            const otherMember = !r.is_group ? members.find((entry: any) => {
              if (entry?.is_self) return false
              const value = entry?.id ?? entry?.user_id ?? entry
              if (value === undefined || value === null) return false
              return String(value) !== myId
            }) : null
            const otherId = otherMember ? String(otherMember.uuid || otherMember.id || otherMember.user_id || otherMember.username || '') : null
            const handleAvatarClick = (event: React.MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              if (otherId) openUserProfile(otherId)
            }
            const roomName = r.name || otherMember?.name || otherMember?.username || t('chatPage.rooms.fallbackName')
            const avatarInitials = otherMember?.initials || (roomName || 'R').slice(0, 2)
            const avatarSrc = otherMember?.avatar || (r as any)?.avatar || null
            const unread = Number((r as any)?.unread_count ?? 0)
            const hasUnread = unread > 0

            return (
              <li
                key={r.id}
                className={`room-item ${currentRoomId === String(r.id) ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                onClick={() => navigate(`/chat/${r.id}`)}
              >
                <AvatarBubble
                  src={avatarSrc}
                  name={roomName}
                  initials={avatarInitials}
                  size="lg"
                  interactive={!r.is_group && !!otherId}
                  onClick={!r.is_group && otherId ? handleAvatarClick : undefined}
                  ariaLabel={r.is_group
                    ? t('chatPage.rooms.groupAria', { name: roomName })
                    : t('chatPage.rooms.profileAria', { name: roomName })}
                />
                <div className="room-main">
                  <div className="room-row room-header">
                    <span className="room-name">{roomName}</span>
                    <div className="room-meta">
                      {hasUnread && (
                        <span className="room-unread" aria-label={t('chatPage.rooms.unreadAria', { count: unread })}>
                          {unread}
                        </span>
                      )}
                      <span className="room-date">{formatDate((r as any)?.updated_at || (r as any)?.created_at)}</span>
                    </div>
                  </div>
                  <div className="room-row dim">
                    <span className="room-last">{preview(r)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Messages area fills the rest */}
      <section className={`chat-pane ${hasRoomOpen ? 'has-room' : 'empty'}`}>
        {hasRoomOpen ? (
          <Outlet context={{ updateRoomUnread }} />
        ) : (
          <div className="empty-inner">
            <h3>{t('chatPage.empty.title')}</h3>
            <p>{t('chatPage.empty.subtitle')}</p>
          </div>
        )}
      </section>

      <DirectMessageModal
        open={dmOpen}
        loading={dmLoading}
        submitting={dmSubmitting}
        users={dmUsers}
        selectedUser={dmSelected}
        message={dmMessage}
        onClose={closeDirectModal}
        onSearch={handleDirectSearch}
        onSelect={(id) => setDmSelected(id)}
        onMessageChange={(value) => setDmMessage(value)}
        onSubmit={handleDirectSubmit}
      />

      <UserProfileModal
        open={profileViewer.open}
        loading={profileViewer.loading}
        profile={profileViewer.profile}
        error={profileViewer.error}
        onClose={closeUserProfile}
      />
    </div>
  )
}

export type ChatOutletContext = {
  updateRoomUnread?: (roomId: string | number, unread: number) => void
}
