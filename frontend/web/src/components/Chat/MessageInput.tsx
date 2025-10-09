//frontend/web/src/api/MessageInput.tsx
import React, { useState } from 'react'
import { OutgoingMessage } from '../../types'

type Props = {
  onSend: (payload: OutgoingMessage) => void
}

export default function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    onSend({ type: 'message', content })
    setText('')
  }

  return (
    <form className="message-input-container" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        aria-label="Message"
      />
      <button type="submit" aria-label="Send">➤</button>
    </form>
  )
}
