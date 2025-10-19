import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../shared/api'
import { useAuth } from '../../context/AuthContext'
import { ChatRoom } from '../../types'
import './CreateRoomModal.css'

interface CreateRoomModalProps {
  open: boolean
  onClose: () => void
  onRoomCreated: (room: ChatRoom) => void
}

export default function CreateRoomModal({ open, onClose, onRoomCreated }: CreateRoomModalProps) {
  const { t } = useTranslation()
  const { token } = useAuth() as any

  const [name, setName] = React.useState('')
  const [invites, setInvites] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nameInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 50)
    } else {
      setName('')
      setInvites('')
      setError(null)
      setLoading(false)
    }
  }, [open])

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

      const parsed = parseInviteEntries(invites)
      if (room?.id && (parsed.emails.length > 0 || parsed.usernames.length > 0)) {
        try {
          const inviteRes = await apiFetch(`/api/chat/rooms/${room.id}/invite/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(parsed),
          })
          if (!inviteRes.ok) throw await errorFromResponse(inviteRes, t('chatPage.createRoom.inviteError'))
        } catch (inviteError) {
          console.warn('[CreateRoomModal] Invite failed', inviteError)
          alert(t('chatPage.createRoom.inviteError'))
        }
      }

      onRoomCreated(room)
      setName('')
      setInvites('')
      setError(null)
      onClose()
    } catch (err: any) {
      setError(err?.message || t('chatPage.createRoom.error'))
    } finally {
      setLoading(false)
    }
  }, [invites, loading, name, onClose, onRoomCreated, t, token])

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
            <span>{t('chatPage.createRoom.inviteLabel')}</span>
            <textarea
              name="group-invites"
              value={invites}
              onChange={(event) => setInvites(event.target.value)}
              placeholder={t('chatPage.createRoom.invitePlaceholder') || undefined}
              disabled={loading}
              rows={3}
            />
            <small className="create-room-hint">{t('chatPage.createRoom.inviteHint')}</small>
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

