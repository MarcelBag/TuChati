// src/components/Chat/RoomItem.tsx
import React from 'react'
import './roomitem.css'

interface Room {
  id: string
  name: string
  is_group: boolean
  last_message?: {
    content?: string
  }
}

interface RoomItemProps {
  room: Room
  active: boolean
  onClick: () => void
}

export default function RoomItem({ room, active, onClick }: RoomItemProps) {
  return (
    <div
      className={`room-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="room-avatar">
        {room.is_group ? '👥' : '💬'}
      </div>
      <div className="room-info">
        <h4>{room.name || 'Untitled Room'}</h4>
        <p className="last-message">
          {room.last_message?.content || 'No messages yet'}
        </p>
      </div>
    </div>
  )
}
