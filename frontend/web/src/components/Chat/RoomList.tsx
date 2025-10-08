// src/components/Chat/RoomList.tsx
import React from 'react'
import RoomItem from './RoomItem'
import './roomlist.css'

export default function RoomList({ rooms, activeRoom, onSelect }) {
  return (
    <div className="rooms-container">
      <div className="room-list-header">
        <h3>Chats</h3>
        <button className="create-room-btn">＋</button>
      </div>

      {rooms.map(room => (
        <RoomItem
          key={room.id}
          room={room}
          active={activeRoom?.id === room.id}
          onClick={() => onSelect(room)}
        />
      ))}
    </div>
  )
}
