// src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room - full-featured, modern design
// ============================================================
import React from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import MessageList from '../components/Chat/MessageList'
import MessageInput from '../components/Chat/MessageInput'
import TypingIndicator from '../components/Chat/TypingIndicator'
import { ChatRoom as ChatRoomType, ChatMessage } from '../types'
import './ChatRoom.css'

export default function ChatRoom() {
  const { roomId } = useParams()
  const { user, token, logout } = useAuth()
  const [room, setRoom] = React.useState<ChatRoomType | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [typingUser, setTypingUser] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Fetch room meta
  React.useEffect(() => {
    if (!roomId || !token) return
    apiFetch(`/api/chat/rooms/${roomId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(setRoom)
      .catch(console.error)
  }, [roomId, token])

  // WebSocket handlers
  const handleIncoming = (data: any) => {
    if (data.type === 'history') {
      setMessages(data.messages)
    } else if (data.type === 'typing') {
      setTypingUser(data.typing ? data.from_user : null)
    } else if (data.sender && (data.content || data.attachment)) {
      setMessages(prev => [...prev, data])
    }
  }

  // ✅ Do NOT coerce to '' — pass as-is so the hook can guard
  const { sendMessage } = useChatSocket(roomId, token, handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  if (!token) return <div className="chat-unauth">Please log in to join the chat.</div>
  if (!roomId) return <div className="chat-unauth">Invalid room. Please select a chat room.</div>
  if (!room) return <div className="chat-unauth">Loading chat room...</div>

  return (
    <div className="chat-room-container">
      <header className="chat-header">
        <div>
          <h2 className="room-name">{room.name || 'Room'}</h2>
          {typingUser ? (
            <span className="typing-status">{typingUser} is typing...</span>
          ) : (
            <span className="online-status">{room.is_group ? 'Group chat' : 'Direct chat'}</span>
          )}
        </div>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </header>

      <div className="chat-messages" ref={listRef}>
        <MessageList messages={messages} currentUser={user} />
      </div>

      <TypingIndicator typingUser={typingUser} />

      <div className="message-input-container">
        <MessageInput onSend={sendMessage} />
      </div>
    </div>
  )
}
