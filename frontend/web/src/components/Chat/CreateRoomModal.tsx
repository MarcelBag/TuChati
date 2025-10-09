//frontend/web/src/components/Chat/CreateRoomModal.tsx
import React from 'react'
import { apiFetch } from '../../shared/api'
import { useAuth } from '../../context/AuthContext'
import { ChatRoom } from '../../types'

interface Props {
  onRoomCreated: (room: ChatRoom) => void
}

export default function CreateRoomModal({ onRoomCreated }: Props) {
  const { token } = useAuth()
  const [name, setName] = React.useState('')
  const [isGroup, setIsGroup] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !token) return
    setLoading(true)
    const res = await apiFetch('/api/chat/rooms/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, is_group: isGroup }),
    })
    if (res.ok) {
      const room: ChatRoom = await res.json()
      onRoomCreated(room)
      setName('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="create-room-form">
      <input
        type="text"
        placeholder="Room name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <label>
        <input
          type="checkbox"
          checked={isGroup}
          onChange={e => setIsGroup(e.target.checked)}
        />
        &nbsp;Group chat
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}
