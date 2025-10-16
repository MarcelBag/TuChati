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
  is_pending?: boolean
  participants: UserMini[]
  created_at: string
  last_message?: ChatMessage | null
}

export interface DirectChatRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined'
  initial_message: string
  created_at: string
  responded_at?: string | null
  from_user: {
    id: string
    username: string
    name?: string
  }
  to_user: {
    id: string
    username: string
    name?: string
  }
  room?: {
    id: string
    is_group: boolean
    is_pending: boolean
  } | null
}
