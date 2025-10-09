// src/pages/ChatPage.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import MessageList from '../api/MessageList'
import MessageInput from '../api/MessageInput'
import TypingIndicator from '../api/TypingIndicator'
import './ChatRoom.css'

interface ChatRoomProps {
  room?: any
}

export default function ChatRoom({ room }: ChatRoomProps) {
  const { roomId } = useParams()
  const { user, token, logout } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentRoomId = room?.id || roomId

  // Fetch room details if needed
  useEffect(() => {
    if (!room && currentRoomId && token) {
      apiFetch(`/api/chat/rooms/${currentRoomId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : null)
        .then(console.log)
        .catch(console.error)
    }
  }, [room, currentRoomId, token])

  const handleIncoming = (data: any) => {
    if (data.type === 'history') setMessages(data.messages)
    else if (data.type === 'typing') setTypingUser(data.typing ? data.from_user : null)
    else if (data.sender && data.content) setMessages(prev => [...prev, data])
  }

  const { sendMessage } = useChatSocket(currentRoomId || '', token || '', handleIncoming)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  if (!token) return <div className="chat-unauth">Please login to join the chat.</div>
  if (!currentRoomId) return <div className="chat-unauth">Invalid room. Please select a chat room.</div>

  return (
    <div className="chat-room-container">
      <header className="chat-header">
        <div>
          <h2 className="room-name">{room?.name || 'Room'}</h2>
          {typingUser ? (
            <span className="typing-status">{typingUser} is typing...</span>
          ) : (
            <span className="online-status">{room?.is_group ? 'Group chat' : 'Direct chat'}</span>
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
