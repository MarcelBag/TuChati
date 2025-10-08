// src/components/Chat/RoomItem.tsx
import React from 'react'
import './roomitem.css'

export default function RoomItem({ room, active, onClick }) {
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
