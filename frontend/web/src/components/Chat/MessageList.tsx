//frontend/web/src/api/MessageList.tsx
import React from 'react'
import { ChatMessage, User } from '../../types'
import './RoomList.css' // or your message styles if separate

type Props = {
  messages: ChatMessage[]
  currentUser: User | null
}

export default function MessageList({ messages, currentUser }: Props) {
  return (
    <>
      {messages.map((m) => {
        const mine = currentUser && (m.sender === currentUser.username || m.sender_id === currentUser.id)
        return (
          <div
            key={m.id ?? `${m.timestamp}-${Math.random()}`}
            className={`message-bubble ${mine ? 'message-me' : 'message-other'}`}
            title={m.timestamp}
          >
            {!mine && m.sender && (
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 4 }}>
                {m.sender}
              </div>
            )}
            <div>{m.content}</div>
          </div>
        )
      })}
    </>
  )
}
