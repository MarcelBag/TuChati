// src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room - full-featured, modern design
// ============================================================

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import MessageList from '../api/MessageList'
import MessageInput from '../api/MessageInput'
import TypingIndicator from '../api/TypingIndicator'
import './ChatRoom.css'

export default function ChatRoom() {
  const { roomId } = useParams()
  const { user, token, logout } = useAuth()
  const [room, setRoom] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 🧩 Fetch room details when page loads
  useEffect(() => {
    if (roomId && token) {
      apiFetch(`/api/chat/rooms/${roomId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => (res.ok ? res.json() : null))
        .then(setRoom)
        .catch(console.error)
    }
  }, [roomId, token])

  // 🧠 WebSocket connection for live chat
  const handleIncoming = (data: any) => {
    if (data.type === 'history') {
      setMessages(data.messages)
    } else if (data.type === 'typing') {
      setTypingUser(data.typing ? data.from_user : null)
    } else if (data.sender && data.content) {
      setMessages(prev => [...prev, data])
    }
  }

  const { sendMessage } = useChatSocket(roomId || '', token || '', handleIncoming)

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  if (!token) {
    return <div className="chat-unauth">Please log in to join the chat.</div>
  }

  if (!roomId) {
    return <div className="chat-unauth">Invalid room. Please select a chat room.</div>
  }

  if (!room) {
    return <div className="chat-unauth">Loading chat room...</div>
  }

  return (
    <div className="chat-room-container">
      {/* Header */}
      <header className="chat-header">
        <div>
          <h2 className="room-name">{room.name || 'Unnamed Room'}</h2>
          {typingUser ? (
            <span className="typing-status">{typingUser} is typing...</span>
          ) : (
            <span className="online-status">
              {room.is_group ? 'Group chat' : 'Direct chat'}
            </span>
          )}
        </div>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </header>

      {/* Message list */}
      <div className="chat-messages" ref={listRef}>
        <MessageList messages={messages} currentUser={user} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator typingUser={typingUser} />

      {/* Input */}
      <div className="message-input-container">
        <MessageInput onSend={sendMessage} />
      </div>
    </div>
  )
}
