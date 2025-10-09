// src/components/Chat/RoomItem.tsx
import React from 'react'
import { ChatRoom } from '../../types'
import './RoomList.css' // reuse list styles (or keep your own roomitem.css)

interface Props {
  room: ChatRoom
  active: boolean
  onClick: () => void
}

export default function RoomItem({ room, active, onClick }: Props) {
  return (
    <div className={`room-item ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="room-avatar">{room.is_group ? '👥' : '💬'}</div>
      <div className="room-info">
        <h4>{room.name || 'Untitled Room'}</h4>
        <p className="last-message">
          {room.last_message?.content || 'No messages yet'}
        </p>
      </div>
    </div>
  )
}
