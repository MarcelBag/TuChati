//frontend/web/src/api/TypingIndicator.tsx
import React from 'react'

export default function TypingIndicator({ typingUser }: { typingUser: string | null }) {
  if (!typingUser) return null
  return (
    <div style={{ padding: '6px 14px', fontSize: '0.85rem', opacity: 0.8 }}>
      {typingUser} is typing…
    </div>
  )
}
