// frontend/web/src/api/MessageInput.tsx
import React, { useState } from 'react'
import './input.css'

export default function MessageInput({ onSend }: { onSend: (msg: string) => void }) {
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <form className="message-input-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="message-input"
      />
      <button type="submit" className="send-btn">➤</button>
    </form>
  )
}
