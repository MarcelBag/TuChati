// src/types/chat.ts
import { UserMini } from './user'

export interface RoomMember {
  id: string | number
  uuid?: string | null
  username: string
  name: string
  email?: string | null
  avatar?: string | null
  initials?: string
  is_self?: boolean
}

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
  is_favorite?: boolean
  is_archived?: boolean
  is_muted?: boolean
  unread_count?: number
  participants: UserMini[]
  members?: RoomMember[]
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
    avatar?: string | null
  }
  to_user: {
    id: string
    username: string
    name?: string
    avatar?: string | null
  }
  room?: {
    id: string
    is_group: boolean
    is_pending: boolean
  } | null
}
