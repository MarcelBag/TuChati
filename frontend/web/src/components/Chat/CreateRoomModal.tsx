//frontend/web/src/components/Chat/CreateRoomModal.tsx
import React, { useState } from "react"
import { apiFetch } from "../../shared/api"
import { useAuth } from "../../context/AuthContext"

interface Props {
  onRoomCreated: (room: any) => void
}

export default function CreateRoomModal({ onRoomCreated }: Props) {
  const { token } = useAuth()
  const [name, setName] = useState("")
  const [isGroup, setIsGroup] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const res = await apiFetch("/api/chat/rooms/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, is_group: isGroup }),
    })

    if (res.ok) {
      const room = await res.json()
      onRoomCreated(room)
      setName("")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="create-room-form">
      <input
        type="text"
        placeholder="Enter room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label>
        <input
          type="checkbox"
          checked={isGroup}
          onChange={(e) => setIsGroup(e.target.checked)}
        />{" "}
        Group chat
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  )
}
