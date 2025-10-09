// src/pages/ChatPage.tsx
// src/pages/ChatPage.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { ChatRoom as Room } from '../types'
import './ChatPage.css'

export default function ChatPage() {
  const { token } = useAuth()
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const navigate = useNavigate()

  React.useEffect(() => {
    let alive = true
    if (!token) return
    ;(async () => {
      try {
        const r = await apiFetch('/api/chat/rooms/', { headers: { Authorization: `Bearer ${token}` } })
        const data = r.ok ? await r.json() : []
        if (alive) setRooms(Array.isArray(data) ? data : [])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token])

  const createRoom = async (name: string, is_group=true) => {
    if (!name.trim()) return
    const r = await apiFetch('/api/chat/rooms/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, is_group }),
    })
    if (!r.ok) return
    const room = await r.json()
    setRooms(prev => [room, ...prev])
    navigate(`/chat/${room.id}`)
  }

  return (
    <div className="chat-shell">
      <aside className="rooms">
        <header className="rooms-hd">
          <h2>Rooms</h2>
          <button
            className="btn small"
            onClick={() => {
              const name = prompt('Room name')
              if (name) createRoom(name)
            }}
          >+ New</button>
        </header>

        <div className="rooms-search">
          <input placeholder="Search or start a new chat" />
        </div>

        <ul className="rooms-list">
          {loading && <li className="hint">Loading…</li>}
          {!loading && rooms.length === 0 && <li className="hint">No rooms yet</li>}
          {rooms.map(r => (
            <li
              key={r.id}
              className="room-item"
              onClick={() => navigate(`/chat/${r.id}`)}
            >
              <div className="avatar-badge">{(r.name || 'R').slice(0,1).toUpperCase()}</div>
              <div className="room-main">
                <div className="room-row">
                  <span className="room-name">{r.name || 'Room'}</span>
                  <span className="room-time">{/* last message time if you have it */}</span>
                </div>
                <div className="room-row dim">
                  <span className="room-last">{
                    r.is_group ? 'Group chat' : 'Direct chat'
                  }</span>
                  {/* unread badge placeholder */}
                  {/* <span className="badge">2</span> */}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat-pane empty">
        <div className="empty-inner">
          <h3>Select a room or create a new one.</h3>
          <p>Your messages will appear here.</p>
        </div>
      </section>
    </div>
  )
}
