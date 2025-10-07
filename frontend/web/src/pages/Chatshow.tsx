// frontend/web/src/pages/ChatRoom.tsx
// frontend/web/src/pages/Chat.tsx
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './chat.css'

interface Message {
  id: number
  sender: 'user' | 'tuchati'
  text: string
}

export default function ChatShowcase() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([])
  const [index, setIndex] = useState(0)

  // Build conversation dynamically from i18n keys
  const conversation: Message[] = [
    { id: 1, sender: 'tuchati', text: t('chat.msg1') },
    { id: 2, sender: 'user', text: t('chat.msg2') },
    { id: 3, sender: 'tuchati', text: t('chat.msg3') },
    { id: 4, sender: 'user', text: t('chat.msg4') },
    { id: 5, sender: 'tuchati', text: t('chat.msg5') },
    { id: 6, sender: 'user', text: t('chat.msg6') },
    { id: 7, sender: 'tuchati', text: t('chat.msg7') },
    { id: 8, sender: 'tuchati', text: t('chat.msg8') },
    { id: 9, sender: 'tuchati', text: t('chat.msg9') },
    { id: 10, sender: 'user', text: t('chat.msg10') },
    { id: 11, sender: 'tuchati', text: t('chat.msg11') },
  ]

  // Animate the conversation
  useEffect(() => {
    if (index < conversation.length) {
      const timer = setTimeout(() => {
        setMessages(prev => [...prev, conversation[index]])
        setIndex(i => i + 1)
      }, 1400)
      return () => clearTimeout(timer)
    }
    // passing in the array to re-run if language changes
  }, [index, t])
  return (
    <div className="chat-page">
      <div className="chat-container">
        <header className="chat-header">
          <img src="/images/TuChati.png" alt="TuChati" className="chat-logo" />
          <h2>{t('chat.title')}</h2>
        </header>

        <div className="chat-body">
          {messages.map(msg => (
            <div key={msg.id} className={`bubble ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
        </div>

        <footer className="chat-footer">
          <div className="typing-indicator">
            {index < conversation.length ? (
              <>
                <span></span><span></span><span></span>
              </>
            ) : (
              <p className="end-text">{t('chat.end')}</p>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
