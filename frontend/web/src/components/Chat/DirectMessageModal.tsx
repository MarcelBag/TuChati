import React from 'react'
import { createPortal } from 'react-dom'
import './Reactions.css'
import AvatarBubble from '../../shared/AvatarBubble'

type DirectMessageModalProps = {
  open: boolean
  loading: boolean
  submitting: boolean
  users: Array<{ id: string; username: string; name?: string; email?: string; avatar?: string | null }>
  selectedUser: string | null
  message: string
  onClose: () => void
  onSearch: (query: string) => void
  onSelect: (userId: string) => void
  onMessageChange: (value: string) => void
  onSubmit: () => void
}

export default function DirectMessageModal({
  open,
  loading,
  submitting,
  users,
  selectedUser,
  message,
  onClose,
  onSearch,
  onSelect,
  onMessageChange,
  onSubmit,
}: DirectMessageModalProps) {
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    console.debug('[UI] Direct modal rendering, body children:', document.body?.children?.length)
    const timer = window.setTimeout(() => {
      onSearch(query.trim())
    }, 200)
    return () => window.clearTimeout(timer)
  }, [open, query, onSearch])

  if (!open) return null

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal-surface forward-modal" onClick={(event) => event.stopPropagation()}>
        <header className="forward-head">
          <div>
            <h4>Start Conversation</h4>
            <p className="forward-preview">Find someone to message</p>
          </div>
          <button type="button" className="forward-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="forward-search">
          <input
            type="search"
            placeholder="Search by username or email"
            value={query}
            name="direct-user-search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="forward-list" aria-live="polite">
          {loading && <div className="forward-hint">Searching…</div>}
          {!loading && query && users.length === 0 && <div className="forward-hint">No matches found.</div>}
          {!loading && (!query || users.length === 0) && !loading && !query && (
            <div className="forward-hint">Type to search for users.</div>
          )}

          {!loading && users.length > 0 && (
            <ul>
              {users.map((user) => {
                const checked = selectedUser === user.id
                return (
                  <li key={user.id}>
                    <label>
                      <input
                        type="radio"
                        name="direct-user"
                        checked={checked}
                        onChange={() => onSelect(user.id)}
                      />
                      <AvatarBubble
                        src={user.avatar}
                        name={user.name || user.username}
                        initials={((user.name || user.username || 'U').trim() || 'U').slice(0, 2).toUpperCase()}
                        size="sm"
                      />
                      <span className="forward-room-name">
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

        <div className="forward-search">
          <textarea
            placeholder="Introduce yourself..."
            value={message}
            name="direct-initial-message"
            onChange={(event) => onMessageChange(event.target.value)}
            rows={3}
          />
        </div>

        <footer className="forward-actions">
          <span className="forward-count">{selectedUser ? 'Recipient selected' : 'No recipient selected'}</span>
          <button type="button" onClick={onClose} className="forward-btn ghost" disabled={submitting}>Cancel</button>
          <button
            type="button"
            onClick={onSubmit}
            className="forward-btn primary"
            disabled={!selectedUser || submitting}
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </footer>
      </div>
    </div>
  , document.body)
}
