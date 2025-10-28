/* frontend/web/src/components/Chat/CreateRoomModal.tsx */
import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../shared/api'
import { useAuth } from '../../context/AuthContext'
import { ChatRoom } from '../../types'
import { searchUsers } from '../../api/chatActions'
import AvatarBubble from '../../shared/AvatarBubble'
import './CreateRoomModal.css'

interface CreateRoomModalProps {
  open: boolean
  onClose: () => void
  onRoomCreated: (room: ChatRoom) => void
}

export default function CreateRoomModal({ open, onClose, onRoomCreated }: CreateRoomModalProps) {
  const { t } = useTranslation()
  const { token, user: currentUser } = useAuth() as any

  const [name, setName] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [manualInvites, setManualInvites] = React.useState('')
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<SearchUser[]>([])
  const [selected, setSelected] = React.useState<Record<string, SearchUser>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nameInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 50)
    } else {
      setName('')
      setQuery('')
      setManualInvites('')
      setSearchResults([])
      setSelected({})
      setError(null)
      setLoading(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    searchUsers(trimmed)
      .then((results: any) => {
        if (cancelled) return
        const rows = Array.isArray(results) ? results : []
        const normalized = rows
          .map((item: any) => ({
            id: String(item.id ?? item.username ?? item.email ?? Math.random()),
            username: item.username || item.handle || '',
            name: item.name || item.display_name || item.username || item.email || '',
            email: item.email || '',
            avatar: item.avatar || item.photo || null,
          }))
          .filter((item) => item.username && (!currentUser?.id || String(item.id) !== String(currentUser.id)))
        setSearchResults(normalized)
      })
      .catch(() => {
        if (!cancelled) setSearchResults([])
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, open, query])

  const selectedList = React.useMemo(() => Object.values(selected), [selected])

  const toggleSelect = React.useCallback((user: SearchUser) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[user.username]) {
        delete next[user.username]
      } else {
        next[user.username] = user
      }
      return next
    })
  }, [])

  const closeIfPossible = React.useCallback(() => {
    if (!loading) onClose()
  }, [loading, onClose])

  const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('chatPage.createRoom.nameRequired'))
      return
    }
    if (!token) {
      setError(t('chatPage.createRoom.error'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/api/chat/rooms/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName, is_group: true }),
      })

      if (!res.ok) throw await errorFromResponse(res, t('chatPage.createRoom.error'))
      const room: ChatRoom = await res.json()

      const parsed = parseInviteEntries(manualInvites)
      const fromSelectedUsernames = selectedList.map((user) => user.username)
      const fromSelectedEmails = selectedList
        .map((user) => user.email)
        .filter((email): email is string => !!email && email.length > 0)
      const usernames = Array.from(new Set([...fromSelectedUsernames, ...parsed.usernames]))
      const emails = Array.from(new Set([...fromSelectedEmails, ...parsed.emails]))

      if (room?.id && (emails.length > 0 || usernames.length > 0)) {
        try {
          const inviteRes = await apiFetch(`/api/chat/rooms/${room.id}/invite/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ usernames, emails }),
          })
          if (!inviteRes.ok) throw await errorFromResponse(inviteRes, t('chatPage.createRoom.inviteError'))
        } catch (inviteError) {
          console.warn('[CreateRoomModal] Invite failed', inviteError)
          alert(t('chatPage.createRoom.inviteError'))
        }
      }

      onRoomCreated(room)
      setName('')
      setQuery('')
      setManualInvites('')
      setSelected({})
      setError(null)
      onClose()
    } catch (err: any) {
      setError(err?.message || t('chatPage.createRoom.error'))
    } finally {
      setLoading(false)
    }
  }, [manualInvites, selectedList, loading, name, onClose, onRoomCreated, t, token])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-wrap" onClick={closeIfPossible} role="presentation">
      <div
        className="modal-surface create-room-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="create-room-head">
          <div>
            <h4 id="create-room-title">{t('chatPage.createRoom.title')}</h4>
            <p className="create-room-subtitle">{t('chatPage.createRoom.subtitle')}</p>
          </div>
          <button
            type="button"
            className="create-room-close"
            onClick={closeIfPossible}
            aria-label={t('profileModal.actions.close') || 'Close'}
            disabled={loading}
          >
            ✕
          </button>
        </header>

        <form className="create-room-form" onSubmit={handleSubmit}>
          {error && <div className="create-room-error" role="alert">{error}</div>}

          <label className="create-room-field">
            <span>{t('chatPage.createRoom.nameLabel')}</span>
            <input
              ref={nameInputRef}
              type="text"
              name="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('chatPage.createRoom.namePlaceholder') || undefined}
              disabled={loading}
              required
            />
          </label>

          <label className="create-room-field">
            <span>{t('chatPage.createRoom.inviteSearchLabel')}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('chatPage.createRoom.inviteSearchPlaceholder') || undefined}
              disabled={loading}
              name="group-invite-search"
            />
            <small className="create-room-hint">{t('chatPage.createRoom.inviteSearchHint')}</small>
          </label>

          <div className="create-room-results" aria-live="polite">
            {searchLoading && <div className="create-room-result-hint">{t('chatPage.createRoom.searching')}</div>}
            {!searchLoading && query && searchResults.length === 0 && (
              <div className="create-room-result-hint">{t('chatPage.createRoom.noMatches')}</div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <ul>
                {searchResults.map((user) => {
                  const checked = !!selected[user.username]
                  return (
                    <li key={user.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(user)}
                          disabled={loading}
                        />
                        <AvatarBubble
                          src={user.avatar}
                          name={user.name || user.username}
                          initials={(user.name || user.username || 'U').slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <span className="create-room-user">
                          {user.name || user.username}
                          {user.email ? ` · ${user.email}` : ''}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {selectedList.length > 0 && (
            <div className="create-room-selected">
              <div className="create-room-selected-header">
                {t('chatPage.createRoom.inviteSelected', { count: selectedList.length })}
              </div>
              <div className="create-room-chips">
                {selectedList.map((user) => (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => toggleSelect(user)}
                  >
                    {(user.name || user.username) + (user.email ? ` · ${user.email}` : '')}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="create-room-field">
            <span>{t('chatPage.createRoom.inviteManualLabel')}</span>
            <textarea
              name="group-invites"
              value={manualInvites}
              onChange={(event) => setManualInvites(event.target.value)}
              placeholder={t('chatPage.createRoom.inviteManualPlaceholder') || undefined}
              disabled={loading}
              rows={3}
            />
            <small className="create-room-hint">{t('chatPage.createRoom.inviteManualHint')}</small>
          </label>

          <footer className="create-room-actions">
            <button type="button" className="btn ghost" onClick={closeIfPossible} disabled={loading}>
              {t('chatPage.createRoom.cancel')}
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? t('chatPage.createRoom.creating') : t('chatPage.createRoom.create')}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function parseInviteEntries(value: string): { usernames: string[]; emails: string[] } {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.startsWith('@') ? token.slice(1) : token)

  const usernames = new Set<string>()
  const emails = new Set<string>()

  for (const token of tokens) {
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(token)) {
      emails.add(token)
    } else {
      usernames.add(token)
    }
  }

  return { usernames: Array.from(usernames), emails: Array.from(emails) }
}

type SearchUser = {
  id: string
  username: string
  name?: string
  email?: string
  avatar?: string | null
}

async function errorFromResponse(res: Response, fallback: string) {
  try {
    const data = await res.clone().json()
    if (typeof data === 'string') return new Error(data)
    if (data?.detail) return new Error(data.detail)
    const combined = Object.values(data || {}).flat().join(' ')
    return new Error(combined || `${fallback} (${res.status})`)
  } catch {
    return new Error(`${fallback} (${res.status})`)
  }
}
