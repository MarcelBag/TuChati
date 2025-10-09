// src/types/chat.ts
import { UserMini } from './user'

/** A chat message sent in a room */
export interface Message {
  id: string
  room: string
  sender: UserMini
  content: string
  is_read: boolean
  created_at: string
  attachment?: string | null
  voice_note?: string | null
  file_type?: string
}

/** A chat room (group or direct) */
export interface Room {
  id: string
  name: string
  is_group: boolean
  description?: string
  icon?: string | null
  participants?: UserMini[]
  last_message?: Message | null
  created_at?: string
}
