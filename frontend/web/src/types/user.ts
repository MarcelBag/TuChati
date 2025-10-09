// src/types/user.ts
// src/types/user.ts

/** Minimal user info returned with messages or rooms */
export interface UserMini {
  id: number
  username: string
  email: string
  avatar?: string | null
}

/** Full user profile for authenticated sessions */
export interface UserProfile extends UserMini {
  bio?: string | null
  phone?: string | null
  status_message?: string
  is_online?: boolean
  current_status?: 'online' | 'away' | 'offline' | 'dnd'
  last_seen?: string
}
