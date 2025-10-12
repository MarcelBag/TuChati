// =============================================================
// TuChati WebSocket Hook
// Handles real-time connection to Django Channels backend
// Auto-detects production vs. local environments
// =============================================================
// src/hooks/useChatSocket.ts
import { useEffect, useRef } from 'react'


type Handler = (data: any) => void

const WS_TEMPLATE =
  import.meta.env.VITE_WS_URL || '' // e.g. ws://localhost:8011/ws/chat/:roomId/
  
function buildWsUrl(roomId: string, token: string) {
  if (WS_TEMPLATE && WS_TEMPLATE.includes(':roomId')) {
    return WS_TEMPLATE.replace(':roomId', roomId) + `?token=${encodeURIComponent(token)}`
  }
  // Fallback: same host, guessed port/protocol
  const isHttps = window.location.protocol === 'https:'
  const proto = isHttps ? 'wss' : 'ws'
  const host = window.location.host // includes port if any
  return `${proto}://${host.replace(/:\d+$/, '')}:8011/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`
}
export function useInviteSocket(token: string | null, onInvite: (data: any) => void) {
  useEffect(() => {
    if (!token) return
    const isHttps = window.location.protocol === 'https:'
    const proto = isHttps ? 'wss' : 'ws'
    const host = window.location.host.replace(/:\d+$/, '')
    const url = `${proto}://${host}:8011/ws/notifications/?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    ws.onmessage = ev => {
      try { onInvite(JSON.parse(ev.data)) } catch {}
    }
    return () => ws.close()
  }, [token, onInvite])
}
export function useChatSocket(
  roomId: string,
  token: string,
  onMessage: Handler,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!roomId || !token) return

    let closedByUs = false
    const url = buildWsUrl(roomId, token)

    const open = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        // socket ready
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          onMessage(data)
        } catch {
          // server sometimes sends plain payload (already JSON-string)
          onMessage(ev.data)
        }
      }

      ws.onclose = () => {
        if (!closedByUs) {
          // retry with backoff
          timerRef.current = window.setTimeout(open, 1000) as unknown as number
        }
      }

      ws.onerror = () => {
        // let onclose handle the retry
      }
    }

    open()

    return () => {
      closedByUs = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [roomId, token, onMessage])

  function sendMessage(payload: any) {
    const s = wsRef.current
    if (s && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(payload))
    }
  }

  return {
    sendMessage,
    sendTyping: (typing: boolean) => sendMessage({ type: typing ? 'typing' : 'stopped_typing' }),
    sendFocus: () => sendMessage({ type: 'focus' }),
  }
}