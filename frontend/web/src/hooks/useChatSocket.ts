// =============================================================
// TuChati WebSocket Hook
// Handles real-time connection to Django Channels backend
// Auto-detects production vs. local environments
// =============================================================

import { useEffect, useRef } from 'react'

export function useChatSocket(roomId: string, token: string, onMessage: (msg: any) => void) {
  // -----------------------------------------------------------
  // Base WebSocket URL (from .env)
  // -----------------------------------------------------------
  const WS_BASE =
    import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, '') || 'ws://localhost:8011'

  // Compose full WebSocket endpoint
  const url = `${WS_BASE}/ws/chat/${roomId}/?token=${token}`

  // Ref to hold socket instance
  const socketRef = useRef<WebSocket | null>(null)

  // -----------------------------------------------------------
  // Lifecycle: connect / reconnect / cleanup
  // -----------------------------------------------------------
  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => console.log('[TuChati] ✅ WebSocket connected:', url)
    socket.onclose = () => console.log('[TuChati] ❌ WebSocket disconnected')
    socket.onerror = (e) => console.error('[TuChati] ⚠️ WebSocket error:', e)

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch {
        console.error('Invalid WebSocket message format')
      }
    }

    // Cleanup on unmount
    return () => socket.close()
  }, [roomId, token])

  // -----------------------------------------------------------
  // Helper: send message through the active socket
  // -----------------------------------------------------------
  const sendMessage = (message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ message }))
    }
  }

  return { sendMessage }
}
