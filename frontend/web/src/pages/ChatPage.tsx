// src/pages/ChatPage.tsx
import React from 'react'
import { useNavigate, useMatch, Outlet } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { ChatRoom as Room } from '../types'
import './ChatPage.css'

export default function ChatPage() {
  const { token } = useAuth()
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeFilter, setActiveFilter] = React.useState<'all'|'unread'|'favorites'|'groups'>('all')
  const navigate = useNavigate()

  // is a room open?
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
    return () => { alive = false }
  }, [token])

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

  return (
    <div className="chat-shell">
      {/* Rooms (always visible on desktop) */}
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
    </div>
  )
}
