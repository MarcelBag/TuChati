// frontend/web/src/api/TypingIndicator.tsx
import React from 'react'
import './typing.css'

export default function TypingIndicator({ typingUser }: { typingUser: string | null }) {
  if (!typingUser) return null
  return (
    <div className="typing-indicator">
      <span>{typingUser} is typing</span>
      <div className="dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  )
}
