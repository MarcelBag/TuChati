// =============================================================
// TuChati WebSocket Hook
// Handles real-time connection to Django Channels backend
// Auto-detects production vs. local environments
// =============================================================
// src/hooks/useChatSocket.ts
import { useEffect, useMemo, useRef } from 'react'

type IncomingHandler = (data: any) => void

export function useChatSocket(
  roomId?: string,
  token?: string,
  onMessage?: IncomingHandler
) {
  const wsRef = useRef<WebSocket | null>(null)

  const sendMessage = useMemo(
    () =>
      (payload: { content?: string; type?: string; attachment?: any }) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        wsRef.current.send(JSON.stringify(payload))
      },
    []
  )

  useEffect(() => {
    // SAFETY GUARD: do not connect without both pieces
    if (!roomId || !token) {
      // optional: console.warn('WS not opened: missing roomId or token', { roomId, hasToken: !!token })
      return
    }

    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${wsScheme}://${window.location.host}/ws/chat/${roomId}/?token=${encodeURIComponent(
      token
    )}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      // console.log('WS open', url)
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch {}
    }
    ws.onerror = () => {
      // console.error('WS error', url, e)
    }
    ws.onclose = () => {
      // console.log('WS closed', url)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [roomId, token, onMessage])

  return { sendMessage }
}
