/* src/pages/ChatPage.tsx */
// src/pages/ChatPage.tsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../shared/api'
import ChatRoom from './ChatRoom'
import RoomList from '../components/Chat/RoomList'
import './ChatPage.css'

export default function ChatPage() {
  const { token } = useAuth()
  const [rooms, setRooms] = useState<any[]>([])
  const [activeRoom, setActiveRoom] = useState<any | null>(null)

  useEffect(() => {
    if (token) {
      apiFetch('/api/chat/rooms/', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : [])
        .then(setRooms)
        .catch(console.error)
    }
  }, [token])

  return (
    <div className="chat-page">
      <aside className="room-list">
        <RoomList
          rooms={rooms}
          activeRoom={activeRoom}
          onSelect={setActiveRoom}
        />
      </aside>

      <main className="chat-main">
        {activeRoom ? (
          <ChatRoom room={activeRoom} />
        ) : (
          <div className="empty-chat">
            <p>Select or create a chat room to start chatting</p>
          </div>
        )}
      </main>
    </div>
  )
}

.chat-page {
  display: flex;
  height: 100vh;
  background: var(--bg-dark, #1c1f26);
  color: #fff;
}

.room-list {
  width: 280px;
  background: #13161b;
  border-right: 1px solid #2c2f36;
  display: flex;
  flex-direction: column;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.empty-chat {
  margin: auto;
  color: #888;
  text-align: center;
  font-size: 1.1rem;
}
