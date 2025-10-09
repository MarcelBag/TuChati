// src/components/Chat/RoomList.tsx
import React from 'react'
import RoomItem from './RoomItem'
import './RoomList.css'

interface Room {
  id: string
  name: string
  is_group: boolean
  last_message?: {
    content?: string
  }
}

interface RoomListProps {
  rooms: Room[]
  activeRoom: Room | null
  onSelect: (room: Room) => void
}

export default function RoomList({ rooms, activeRoom, onSelect }: RoomListProps) {
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
