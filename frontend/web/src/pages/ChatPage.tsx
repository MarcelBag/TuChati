// src/pages/ChatPage.tsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../shared/api'
import RoomList from '../components/Chat/RoomList'
import CreateRoomModal from '../components/Chat/CreateRoomModal'
import './ChatPage.css'
import { useNavigate } from 'react-router-dom'
import { ChatRoom as ChatRoomType } from '../types'

export default function ChatPage() {
  const { token } = useAuth()
  const [rooms, setRooms] = useState<ChatRoomType[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    apiFetch('/api/chat/rooms/', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(setRooms)
      .catch(console.error)
  }, [token])

  const handleRoomCreated = (room: ChatRoomType) => {
    setRooms(prev => [room, ...prev])
    navigate(`/chat/${room.id}`)
  }

  const handleSelect = (room: ChatRoomType) => {
    navigate(`/chat/${room.id}`)
  }

  return (
    <div className="chat-page">
      <aside className="room-list">
        <div className="room-list-header">
          <h3>Rooms</h3>
          <CreateRoomModal onRoomCreated={handleRoomCreated} />
        </div>
        <RoomList rooms={rooms} activeRoom={null} onSelect={handleSelect} />
      </aside>
      <main className="chat-main">
        <div className="empty-chat">Select a room or create a new one.</div>
      </main>
    </div>
  )
}
