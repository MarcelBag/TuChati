import React from 'react'
import './Reactions.css'

type RoomOption = {
  id: string
  name: string
  is_group?: boolean
  last_message_preview?: string
}

type ForwardMessageModalProps = {
  open: boolean
  loading: boolean
  submitting: boolean
  rooms: RoomOption[]
  selected: string[]
  message: any | null
  onClose: () => void
  onToggle: (roomId: string) => void
  onSubmit: () => void
}

export default function ForwardMessageModal({
  open,
  loading,
  submitting,
  rooms,
  selected,
  message,
  onClose,
  onToggle,
  onSubmit,
}: ForwardMessageModalProps) {
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  if (!open) return null

  const lower = query.trim().toLowerCase()
  const filtered = lower
    ? rooms.filter((room) => room.name.toLowerCase().includes(lower))
    : rooms

  const preview = (() => {
    if (!message) return ''
    if (message.text) return message.text
    if (message.attachment) return 'Attachment'
    if (message.audio) return 'Voice message'
    return 'Message'
  })()

  return (
    <div className="ctx-wrap" onClick={onClose}>
      <div className="menu ctx forward-modal" onClick={(event) => event.stopPropagation()}>
        <header className="forward-head">
          <div>
            <h4>Forward message</h4>
            <p className="forward-preview">{preview}</p>
          </div>
          <button type="button" className="forward-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="forward-search">
          <input
            type="search"
            placeholder="Search rooms"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="forward-list" aria-live="polite">
          {loading && <div className="forward-hint">Loading rooms…</div>}
          {!loading && filtered.length === 0 && (
            <div className="forward-hint">No rooms found.</div>
          )}

          {!loading && filtered.length > 0 && (
            <ul>
              {filtered.map((room) => {
                const checked = selected.includes(room.id)
                return (
                  <li key={room.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(room.id)}
                      />
                      <span className="forward-room-name">{room.name || 'Room'}</span>
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
            disabled={submitting || selected.length === 0}
          >
            {submitting ? 'Forwarding…' : 'Forward'}
          </button>
        </footer>
      </div>
    </div>
  )
}
