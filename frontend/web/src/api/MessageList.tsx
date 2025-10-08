// frontend/web/src/api/MessageList.tsx
import React from 'react'
import './message.css'

export default function MessageList({ messages, currentUser }: any) {
  return (
    <div className="message-list">
      {messages.map((m: any) => {
        const isMine = m.sender === currentUser?.username
        return (
          <div key={m.id} className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
            {!isMine && <span className="sender">{m.sender}</span>}
            <p className="content">{m.content}</p>
            <span className="time">{new Date(m.created_at).toLocaleTimeString()}</span>
          </div>
        )
      })}
    </div>
  )
}
