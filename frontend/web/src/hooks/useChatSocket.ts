// src/hooks/useChatSocket.ts
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8011'
const url = `${WS_BASE}/ws/chat/${roomId}/?token=${token}`
