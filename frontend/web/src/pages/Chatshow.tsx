// frontend/web/src/pages/ChatRoom.tsx
import React, { useEffect, useState } from 'react'
import './Chatshow.css'

interface Message {
  id: number
  sender: 'user' | 'tuchati'
  text: string
}

const conversation: Message[] = [
  { id: 1, sender: 'tuchati', text: 'Hey there 👋 Welcome to TuChati!' },
  { id: 2, sender: 'user', text: 'Hello! How are you?' },
  {
    id: 3,
    sender: 'tuchati',
    text: 'I’m TuChati, built by Tuungane to help communities better communicate — especially where internet access is still a luxury.',
  },
  { id: 4, sender: 'user', text: 'That’s awesome! What makes you better than other social media apps?' },
  {
    id: 5,
    sender: 'tuchati',
    text: 'I’m deeply integrated with African values, designed for underprivileged communities, and built to assist everyone with respect and accessibility.',
  },
  { id: 6, sender: 'user', text: 'What do you aim to achieve?' },
  {
    id: 7,
    sender: 'tuchati',
    text: 'We aim to assist people and communities — revolutionizing the way farmers, educators, scholars, doctors, bankers, and even politicians connect and collaborate.',
  },
  {
    id: 8,
    sender: 'tuchati',
    text: 'We’re planning to offer many exciting features soon — and we’d love to have you join us.',
  },
  { id: 9, sender: 'tuchati', text: 'Are you willing to share TuChati with your community?' },
  { id: 10, sender: 'user', text: 'Yes, of course! 😊' },
  { id: 11, sender: 'tuchati', text: 'Thank you for your support 💚 — Your TuChati Community Team.' },
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index < conversation.length) {
      const timer = setTimeout(() => {
        setMessages(prev => [...prev, conversation[index]])
        setIndex(i => i + 1)
      }, 1400)
      return () => clearTimeout(timer)
    }
  }, [index])

  return (
    <div className="chat-page">
      <div className="chat-container">
        <header className="chat-header">
          <img src="/images/TuChati.png" alt="TuChati" className="chat-logo" />
          <h2>TuChati Showcase</h2>
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
              <p className="end-text">Conversation ended • Join us soon 💬</p>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
