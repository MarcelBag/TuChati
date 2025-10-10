// ============================================================
// TuChati Chat Room - fills all remaining width in ChatPage
// ============================================================
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { ChatRoom as Room, ChatMessage } from '../types'
import './ChatRoom.css'

export default function ChatRoom() {
  const { roomId } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = React.useState<Room | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [typingUser, setTypingUser] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [showInfo, setShowInfo] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!roomId || !token) return
    ;(async () => {
      const r = await apiFetch(`/api/chat/rooms/${roomId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) setRoom(await r.json())
      else navigate('/chat')
    })()
  }, [roomId, token, navigate])

  const handleIncoming = (data: any) => {
    if (data.type === 'history') setMessages(data.messages || [])
    else if (data.type === 'typing') setTypingUser(data.typing ? data.from_user : null)
    else if (data.sender && (data.content || data.attachment)) setMessages(prev => [...prev, data])
  }

  const { sendMessage, sendTyping } = useChatSocket(roomId || '', token || '', handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const onSend = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage({ content: text })       // emoji input works natively
    setDraft('')
  }

  if (!token) return null

  const isGroup = !!room?.is_group
  const isAdmin =
    !!(room as any)?.is_admin ||
    (Array.isArray((room as any)?.admin_ids) && (room as any).admin_ids.includes(user?.id))

  return (
    <>
      <header className="chat-hd">
        <div
          className="title"
          role={isGroup ? 'button' : undefined}
          tabIndex={isGroup ? 0 : -1}
          onClick={() => isGroup && setShowInfo(s => !s)}
          onKeyDown={(e) => {
            if (!isGroup) return
            if (e.key === 'Enter' || e.key === ' ') setShowInfo(s => !s)
          }}
          title={isGroup ? (showInfo ? 'Hide group info' : 'Show group info') : undefined}
        >
          <div className="avatar-badge lg">
            {(room?.name || 'R').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="name">{room?.name || 'Room'}</div>
            <div className="sub">
              {typingUser ? `${typingUser} is typing…` : isGroup ? 'Group chat' : 'Direct chat'}
            </div>
          </div>
        </div>
        {/* No separate “Close info” button anymore – title toggles the drawer */}
      </header>

      <div className="chat-scroll" ref={listRef}>
        {messages.map((m, idx) => {
          const mine = m.sender?.id === user?.id || m.sender === user?.id
          return (
            <div key={m.id || idx} className={`bubble-row ${mine ? 'right' : 'left'}`}>
              {!mine && (
                <div className="avatar-badge sm">
                  {(m.sender_name || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className={`bubble ${mine ? 'me' : ''}`}>
                {m.content && <p>{m.content}</p>}
                {m.attachment && (
                  <a className="attach" href={m.attachment} target="_blank" rel="noreferrer">
                    Attachment
                  </a>
                )}
                <span className="time">
                  {m.created_at
                    ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <footer className="composer">
        <input
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            sendTyping(true)
          }}
          onBlur={() => sendTyping(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Type a message"
        />
        <button className="send" onClick={onSend} aria-label="Send">➤</button>
      </footer>

      {/* Right management drawer for group rooms */}
      {isGroup && (
        <aside className={`room-info ${showInfo ? 'open' : ''}`}>
          <div className="room-info-hd">
            <div className="avatar-badge lg">{(room?.name || 'R').slice(0, 1).toUpperCase()}</div>
            <div className="ri-meta">
              <h4>{room?.name}</h4>
              <p>{(room as any)?.member_count ?? (room as any)?.members?.length ?? 0} members</p>
            </div>
            <button className="ri-close" onClick={() => setShowInfo(false)} aria-label="Close info">✕</button>
          </div>

          <div className="ri-section">
            <div className="ri-title">Members</div>
            <ul className="ri-list">
              {(room as any)?.members?.map((m: any) => (
                <li key={m.id}>
                  <span className="ri-avatar">{(m.name || m.username || 'U').slice(0, 1)}</span>
                  <span className="ri-name">{m.name || m.username || m.email}</span>
                  {isAdmin && m.id !== user?.id && (
                    <button
                      className="ri-action"
                      onClick={async () => {
                        await apiFetch(`/api/chat/rooms/${roomId}/members/${m.id}/`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        setRoom(prev =>
                          prev ? { ...prev, members: (prev as any).members.filter((x: any) => x.id !== m.id) } : prev
                        )
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isAdmin && (
              <button
                className="btn small"
                onClick={async () => {
                  const email = prompt('Invite by email')
                  if (!email) return
                  await apiFetch(`/api/chat/rooms/${roomId}/invite/`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                  })
                }}
              >
                + Add member
              </button>
            )}
          </div>

          {isAdmin ? (
            <div className="ri-section">
              <div className="ri-title">Admin tools</div>
              <div className="ri-actions">
                <button
                  className="btn small"
                  onClick={async () => {
                    const name = prompt('Rename group', room?.name || '')
                    if (!name) return
                    await apiFetch(`/api/chat/rooms/${roomId}/`, {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name }),
                    })
                    setRoom(prev => (prev ? { ...prev, name } : prev))
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn small"
                  onClick={async () => {
                    await apiFetch(`/api/chat/rooms/${roomId}/mute/`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                  }}
                >
                  Mute
                </button>
                <button
                  className="btn small"
                  onClick={async () => {
                    if (!confirm('Delete this group?')) return
                    await apiFetch(`/api/chat/rooms/${roomId}/`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    navigate('/chat')
                  }}
                >
                  Delete group
                </button>
              </div>
            </div>
          ) : (
            <div className="ri-section">
              <div className="ri-title">Actions</div>
              <button
                className="btn small"
                onClick={async () => {
                  if (!confirm('Leave this group?')) return
                  await apiFetch(`/api/chat/rooms/${roomId}/leave/`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  navigate('/chat')
                }}
              >
                Leave group
              </button>
            </div>
          )}
        </aside>
      )}
    </>
  )
}
