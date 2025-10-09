// src/components/Chat/RoomList.tsx
import React from 'react'
import RoomItem from './RoomItem'
import './RoomList.css'
import { ChatRoom } from '../../types'

interface Props {
  rooms: ChatRoom[]
  activeRoom: ChatRoom | null
  onSelect: (room: ChatRoom) => void
}

export default function RoomList({ rooms, activeRoom, onSelect }: Props) {
  return (
    <div className="rooms-container">
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
