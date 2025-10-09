// src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room - full-featured, modern design
// ============================================================
// src/pages/ChatRoom.tsx
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
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!roomId || !token) return
    ;(async () => {
      const r = await apiFetch(`/api/chat/rooms/${roomId}/`, { headers: { Authorization: `Bearer ${token}` }})
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
    sendMessage({ content: text })
    setDraft('')
  }

  if (!token) return null

  return (
    <div className="chat-shell">
      {/* Sidebar kept by ChatPage—when routed directly, show a minimal back */}
      <aside className="rooms rooms-compact">
        <button className="btn small ghost" onClick={() => navigate('/chat')}>← Rooms</button>
      </aside>

      <section className="chat-pane">
        <header className="chat-hd">
          <div className="title">
            <div className="avatar-badge lg">{(room?.name || 'R').slice(0,1).toUpperCase()}</div>
            <div>
              <div className="name">{room?.name || 'Room'}</div>
              <div className="sub">{typingUser ? `${typingUser} is typing…` : (room?.is_group ? 'Group chat' : 'Direct chat')}</div>
            </div>
          </div>
          {/* room actions slot if needed */}
        </header>

        <div className="chat-scroll" ref={listRef}>
          {messages.map((m, idx) => {
            const mine = m.sender?.id === user?.id || m.sender === user?.id
            return (
              <div key={m.id || idx} className={`bubble-row ${mine ? 'right' : 'left'}`}>
                {!mine && <div className="avatar-badge sm">{(m.sender_name || 'U').slice(0,1).toUpperCase()}</div>}
                <div className={`bubble ${mine ? 'me' : ''}`}>
                  {m.content && <p>{m.content}</p>}
                  {m.attachment && (
                    <a className="attach" href={m.attachment} target="_blank" rel="noreferrer">Attachment</a>
                  )}
                  <span className="time">{m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</span>
                </div>
              </div>
            )
          })}
        </div>

        <footer className="composer">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              sendTyping(true)
            }}
            onBlur={() => sendTyping(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Type a message"
          />
          <button className="send" onClick={onSend} aria-label="Send">➤</button>
        </footer>
      </section>
    </div>
  )
}
