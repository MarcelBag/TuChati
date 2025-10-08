// src/pages/ChatRoom.tsx
// ============================================================
// src/pages/ChatRoom.tsx
// Beautiful TuChati chat room UI
// ============================================================

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../api/chat'
import MessageList from '../api/MessageList'
import MessageInput from '../api/MessageInput'
import TypingIndicator from '../api/TypingIndicator'
import './chatroom.css'

export default function ChatRoom() {
  const { roomId } = useParams()
  const { user, token, logout } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Handle incoming websocket messages
  const handleIncoming = (data: any) => {
    if (data.type === 'history') setMessages(data.messages)
    else if (data.type === 'typing') {
      if (data.typing) setTypingUser(data.from_user)
      else setTypingUser(null)
    } else if (data.type === 'presence') {
      console.log(`[Presence] ${data.user} is ${data.status}`)
    } else if (data.sender && data.content) {
      // normal message
      setMessages(prev => [...prev, data])
    }
  }

  const { sendMessage } = useChatSocket(roomId || '', token || '', handleIncoming)

  useEffect(() => {
    // scroll to bottom on new message
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  if (!token) return <div className="chat-unauth">Please login to join the chat.</div>

  return (
    <div className="chat-room-container">
      {/* Header */}
      <header className="chat-header">
        <div>
          <h2 className="room-name">Room {roomId?.slice(0, 6)}</h2>
          {typingUser ? (
            <span className="typing-status">{typingUser} is typing...</span>
          ) : (
            <span className="online-status">Online</span>
          )}
        </div>

        <button className="logout-btn" onClick={logout}>Logout</button>
      </header>

      {/* Message list */}
      <div className="chat-messages" ref={listRef}>
        <MessageList messages={messages} currentUser={user} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator typingUser={typingUser} />

      {/* Message input */}
      <MessageInput onSend={sendMessage} />
    </div>
  )
}
