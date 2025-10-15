import React from 'react'
import './Reactions.css'

type UserOption = {
  id: string
  username: string
  email?: string
  name?: string
}

type InviteUsersModalProps = {
  open: boolean
  loading: boolean
  submitting: boolean
  users: UserOption[]
  selected: string[]
  onClose: () => void
  onSearch: (query: string) => void
  onToggle: (id: string) => void
  onSubmit: () => void
}

export default function InviteUsersModal({
  open,
  loading,
  submitting,
  users,
  selected,
  onClose,
  onSearch,
  onToggle,
  onSubmit,
}: InviteUsersModalProps) {
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      onSearch(query.trim())
    }, 200)
    return () => window.clearTimeout(t)
  }, [open, query, onSearch])

  if (!open) return null

  const filtered = users

  return (
    <div className="ctx-wrap" onClick={onClose}>
      <div className="menu ctx invite-modal" onClick={(event) => event.stopPropagation()}>
        <header className="forward-head">
          <div>
            <h4>Invite people</h4>
            <p className="forward-preview">Search by username or email</p>
          </div>
          <button type="button" className="forward-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="forward-search">
          <input
            type="search"
            placeholder="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="forward-list" aria-live="polite">
          {loading && <div className="forward-hint">Searching…</div>}
          {!loading && filtered.length === 0 && (
            <div className="forward-hint">No users found.</div>
          )}

          {!loading && filtered.length > 0 && (
            <ul>
              {filtered.map((user) => {
                const checked = selected.includes(user.username)
                return (
                  <li key={user.id || user.username}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(user.username)}
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

        <footer className="forward-actions">
          <span className="forward-count">{selected.length} selected</span>
          <button type="button" onClick={onClose} className="forward-btn ghost" disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="forward-btn primary"
            disabled={selected.length === 0 || submitting}
          >
            {submitting ? 'Inviting…' : 'Invite'}
          </button>
        </footer>
      </div>
    </div>
  )
}
