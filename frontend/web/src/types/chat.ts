// src/types/chat.ts
import { UserMini } from './user'

export interface ChatMessage {
  id: string
  room: string
  sender: UserMini
  content: string
  created_at: string
  is_read?: boolean
  attachment?: string | null
}

export interface ChatRoom {
  id: string
  name: string
  is_group: boolean
  participants: UserMini[]
  created_at: string
  last_message?: ChatMessage | null
}
