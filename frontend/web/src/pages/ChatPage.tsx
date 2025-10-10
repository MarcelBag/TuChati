// src/pages/ChatPage.tsx
import React from 'react'
import ReactDOM from 'react-dom'
import { useNavigate, useMatch, Outlet } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { ChatRoom as Room } from '../types'
import './ChatPage.css'

type RoomAction =
  | 'open'
  | 'rename'
  | 'archive'
  | 'pin'
  | 'mark_unread'
  | 'mute'
  | 'leave'
  | 'delete'

/** Close when clicking outside */
function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = React.useRef<T | null>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return ref
}

function RoomActionsMenu({
  room,
  anchor,
  onClose,
  onAction,
}: {
  room: Room
  anchor: DOMRect
  onClose: () => void
  onAction: (a: RoomAction) => void
}) {
  const ref = useClickOutside<HTMLDivElement>(onClose)
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchor.bottom + 6,
    left: Math.min(anchor.left, window.innerWidth - 240),
    width: 220,
    zIndex: 50,
  }

  const items: { key: RoomAction; label: string; danger?: boolean }[] = [
    { key: 'open', label: 'Open chat' },
    ...(room.is_group ? [{ key: 'rename', label: 'Rename group' } as const] : []),
    { key: 'pin', label: 'Pin chat' },
    { key: 'archive', label: 'Archive chat' },
    { key: 'mark_unread', label: 'Mark as unread' },
    { key: 'mute', label: 'Mute notifications' },
    ...(room.is_group
      ? [{ key: 'leave', label: 'Leave group', danger: true } as const]
      : [{ key: 'delete', label: 'Delete chat', danger: true } as const]),
  ]

  return ReactDOM.createPortal(
    <div ref={ref} className="menu" style={style} role="menu" aria-label="Room actions">
      {items.map(i => (
        <button
          key={i.key}
          className={`menu-item ${i.danger ? 'danger' : ''}`}
          onClick={() => onAction(i.key)}
        >
          {i.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

export default function ChatPage() {
  const { token } = useAuth()
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeFilter, setActiveFilter] = React.useState('all')
  const [menuFor, setMenuFor] = React.useState<{ room: Room; rect: DOMRect } | null>(null)

  const navigate = useNavigate()

  // Do we have /chat/:roomId selected?
  const match = useMatch('/chat/:roomId')
  const hasRoomOpen = !!match
  const currentRoomId = match?.params.roomId

  React.useEffect(() => {
    let alive = true
    if (!token) return
    ;(async () => {
      try {
        const r = await apiFetch('/api/chat/rooms/', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = r.ok ? await r.json() : []
        if (alive) setRooms(Array.isArray(data) ? data : [])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const createRoom = async (name: string, is_group = true) => {
    if (!name.trim()) return
    const r = await apiFetch('/api/chat/rooms/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, is_group }),
    })
    if (!r.ok) return
    const room = await r.json()
    setRooms(prev => [room, ...prev])
    navigate(`/chat/${room.id}`)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  }

  return (
    <div className="chat-shell">
      {/* Left: rooms list (always visible) */}
      <aside className="rooms">
        <header className="rooms-hd">
          <h2>Rooms</h2>
          <button
            className="btn small"
            onClick={() => {
              const name = prompt('Room name')
              if (name) createRoom(name)
            }}
          >
            + New
          </button>
        </header>

        <div className="rooms-search">
          <input placeholder="Search or start a new chat" />
        </div>

        {/* Filter tabs */}
        <div className="rooms-filters">
          <button
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread
          </button>
          <button
            className={`filter-tab ${activeFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveFilter('favorites')}
          >
            Favorites
          </button>
          <button
            className={`filter-tab ${activeFilter === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveFilter('groups')}
          >
            Groups
          </button>
        </div>

        <ul className="rooms-list">
          {loading && <li className="hint">Loading…</li>}
          {!loading && rooms.length === 0 && <li className="hint">No rooms yet</li>}
          {rooms.map(r => (
            <li
              key={r.id}
              className={`room-item ${currentRoomId === String(r.id) ? 'active' : ''}`}
              onClick={e => {
                // ignore row click if user clicked kebab
                const t = e.target as HTMLElement
                if (t.closest('.room-kebab')) return
                navigate(`/chat/${r.id}`)
              }}
            >
              <div className="avatar-badge">
                {(r.name || 'R').slice(0, 1).toUpperCase()}
              </div>

              <div className="room-main">
                <div className="room-row">
                  <span className="room-name">{r.name || 'Room'}</span>
                  <span className="room-date">{formatDate(r.updated_at || r.created_at)}</span>
                </div>
                <div className="room-row dim">
                  <span className="room-last">
                    {r.last_message || (r.is_group ? 'Group chat' : 'Direct chat')}
                  </span>
                  {r.unread_count > 0 && <span className="badge">{r.unread_count}</span>}
                </div>
              </div>

              <button
                className="room-kebab"
                aria-label="More"
                onClick={e => {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                  setMenuFor({ room: r, rect })
                }}
                title="More"
              >
                ⋮
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Right: messages area fills ALL remaining space */}
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

      {/* Actions menu (portal) */}
      {menuFor && (
        <RoomActionsMenu
          room={menuFor.room}
          anchor={menuFor.rect}
          onClose={() => setMenuFor(null)}
          onAction={async a => {
            const rid = menuFor.room.id
            setMenuFor(null)
            if (a === 'open') return navigate(`/chat/${rid}`)

            const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            try {
              if (a === 'rename') {
                const name = prompt('New group name', menuFor.room.name || '')
                if (!name) return
                await apiFetch(`/api/chat/rooms/${rid}/`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ name }),
                })
                setRooms(prev => prev.map(x => (x.id === rid ? { ...x, name } : x)))
              }
              if (a === 'archive')
                await apiFetch(`/api/chat/rooms/${rid}/archive/`, { method: 'POST', headers })
              if (a === 'pin')
                await apiFetch(`/api/chat/rooms/${rid}/pin/`, { method: 'POST', headers })
              if (a === 'mark_unread')
                await apiFetch(`/api/chat/rooms/${rid}/mark-unread/`, { method: 'POST', headers })
              if (a === 'mute')
                await apiFetch(`/api/chat/rooms/${rid}/mute/`, { method: 'POST', headers })
              if (a === 'leave') {
                await apiFetch(`/api/chat/rooms/${rid}/leave/`, { method: 'POST', headers })
                setRooms(prev => prev.filter(x => x.id !== rid))
                if (currentRoomId === String(rid)) navigate('/chat')
              }
              if (a === 'delete') {
                if (!confirm('Delete this chat for you?')) return
                await apiFetch(`/api/chat/rooms/${rid}/`, { method: 'DELETE', headers })
                setRooms(prev => prev.filter(x => x.id !== rid))
                if (currentRoomId === String(rid)) navigate('/chat')
              }
            } catch (err) {
              console.warn('Room action failed', err)
            }
          }}
        />
      )}
    </div>
  )
}
