// src/pages/ChatPage.tsx
import React from 'react'
import { useNavigate, useMatch, Outlet } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { ChatRoom as Room, DirectChatRequest } from '../types'
import DirectMessageModal from '../components/Chat/DirectMessageModal'
import { createDirectRequest, decideDirectRequest, fetchDirectRequests, searchUsers } from '../api/chatActions'
import './ChatPage.css'

export default function ChatPage() {
  const { token, user: currentUser } = useAuth() as any
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeFilter, setActiveFilter] = React.useState<'all'|'unread'|'favorites'|'groups'>('all')
  const [directRequests, setDirectRequests] = React.useState<{ incoming: DirectChatRequest[]; outgoing: DirectChatRequest[] }>({ incoming: [], outgoing: [] })
  const [requestLoading, setRequestLoading] = React.useState(false)
  const [dmOpen, setDmOpen] = React.useState(false)
  const [dmUsers, setDmUsers] = React.useState<Array<{ id: string; username: string; name?: string; email?: string }>>([])
  const [dmLoading, setDmLoading] = React.useState(false)
  const [dmSubmitting, setDmSubmitting] = React.useState(false)
  const [dmSelected, setDmSelected] = React.useState<string | null>(null)
  const [dmMessage, setDmMessage] = React.useState('')
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
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // SAFELY render last message preview (avoid objects causing React crash)
  function preview(room: any): string {
    // common fields we may get from the API
    const lm = room?.last_message
    if (typeof lm === 'string') return lm
    if (lm && typeof lm === 'object') {
      return lm.content || lm.text || '[attachment]'
    }
    // other possible server fields
    return room?.last_message_text || room?.last_text || (room?.is_group ? 'Group chat' : 'Direct chat')
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
        })).filter((user) => user.username && String(user.id) !== String(currentUser?.id)))
      })
      .catch(() => setDmUsers([]))
      .finally(() => setDmLoading(false))
  }, [currentUser?.id, dmOpen])

  const handleDirectSubmit = React.useCallback(async () => {
    if (!dmSelected) {
      alert('Choose a user to message.')
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
        alert('Request sent. Waiting for recipient approval.')
      }
      closeDirectModal()
    } catch (error: any) {
      alert(error?.message || 'Unable to start chat')
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
      alert(error?.message || 'Unable to update request')
    }
  }, [loadDirectRequests, loadRooms, navigate])

  return (
    <div className="chat-shell">
      {/* Rooms (always visible on desktop) */}
      <aside className="rooms">
        <header className="rooms-hd">
          <h2>Rooms</h2>
          <div className="rooms-actions">
            <button
              className="btn small"
              onClick={() => {
                const name = prompt('Room name')
                if (name) createRoom(name)
              }}
            >
              + New
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
              + Direct
            </button>
          </div>
        </header>

        <div className="rooms-search">
          <input name="room-search" placeholder="Search or start a new chat" />
        </div>

        <div className="rooms-filters">
          {(['all','unread','favorites','groups'] as const).map(k => (
            <button
              key={k}
              className={`filter-tab ${activeFilter === k ? 'active' : ''}`}
              onClick={() => setActiveFilter(k)}
            >
              {k[0].toUpperCase()+k.slice(1)}
            </button>
          ))}
        </div>

        {requestLoading && <div className="direct-requests"><p className="hint">Loading requests…</p></div>}
        {!requestLoading && (directRequests.incoming.length > 0 || directRequests.outgoing.length > 0) && (
          <div className="direct-requests">
            {directRequests.incoming.length > 0 && (
              <div className="direct-section">
                <h4>Incoming requests</h4>
                <ul>
                  {directRequests.incoming.map(req => (
                    <li key={req.id}>
                      <div className="direct-meta">
                        <strong>{req.from_user.name || req.from_user.username}</strong>
                        <span>{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                      {req.initial_message && <p className="direct-message">{req.initial_message}</p>}
                      <div className="direct-actions">
                        <button type="button" onClick={() => handleDirectDecision(req.id, 'accept')}>Accept</button>
                        <button type="button" onClick={() => handleDirectDecision(req.id, 'decline')}>Decline</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {directRequests.outgoing.length > 0 && (
              <div className="direct-section">
                <h4>Pending sent</h4>
                <ul>
                  {directRequests.outgoing.map(req => (
                    <li key={req.id}>
                      <div className="direct-meta">
                        <strong>{req.to_user.name || req.to_user.username}</strong>
                        <span>{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                      {req.initial_message && <p className="direct-message">{req.initial_message}</p>}
                      <span className="direct-status">Waiting for approval</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <ul className="rooms-list">
          {loading && <li className="hint">Loading…</li>}
          {!loading && rooms.length === 0 && <li className="hint">No rooms yet</li>}
          {rooms.map(r => (
            <li
              key={r.id}
              className={`room-item ${currentRoomId === String(r.id) ? 'active' : ''}`}
              onClick={() => navigate(`/chat/${r.id}`)}
            >
              <div className="avatar-badge">{(r.name || 'R').slice(0,1).toUpperCase()}</div>
              <div className="room-main">
                <div className="room-row">
                  <span className="room-name">{r.name || 'Room'}</span>
                  <span className="room-date">{formatDate((r as any)?.updated_at || (r as any)?.created_at)}</span>
                </div>
                <div className="room-row dim">
                  <span className="room-last">{preview(r)}</span>
                  {(r as any)?.unread_count > 0 && <span className="badge">{(r as any).unread_count}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Messages area fills the rest */}
      <section className={`chat-pane ${hasRoomOpen ? 'has-room' : 'empty'}`}>
        {hasRoomOpen ? (
          <Outlet />
        ) : (
          <div className="empty-inner">
            <h3>Select a room or create a new one.</h3>
            <p>Your messages will appear here.</p>
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
    </div>
  )
}
