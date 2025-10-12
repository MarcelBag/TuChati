// src/hooks/useChatSocket.ts
import { useEffect, useRef } from 'react'

type Handler = (data: any) => void

const WS_TEMPLATE = import.meta.env.VITE_WS_URL || ''

function buildWsUrl(roomId: string, token: string) {
  if (WS_TEMPLATE && WS_TEMPLATE.includes(':roomId')) {
    return WS_TEMPLATE.replace(':roomId', roomId) + `?token=${encodeURIComponent(token)}`
  }
  const isHttps = window.location.protocol === 'https:'
  const proto = isHttps ? 'wss' : 'ws'
  const host = window.location.host.replace(/:\d+$/, '')
  return `${proto}://${host}:8011/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`
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
      try { onInvite(JSON.parse(ev.data)) } catch { /* noop */ }
    }
    return () => ws.close(1000, 'unmount')
  }, [token, onInvite])
}

// -------------------------------------------------------------
// Main chat WebSocket hook (stable)
// -------------------------------------------------------------
export function useChatSocket(roomId: string, token: string, onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const closingRef = useRef(false)
  const connectingRef = useRef(false)
  const handlerRef = useRef<Handler>(() => {})

  // Keep the latest handler without retriggering the socket effect
  useEffect(() => {
    handlerRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!roomId || !token) return

    const url = buildWsUrl(roomId, token)
    closingRef.current = false

    const cleanupTimer = () => {
      if (retryRef.current) {
        window.clearTimeout(retryRef.current)
        retryRef.current = null
      }
    }

    const connect = () => {
      if (closingRef.current || connectingRef.current || wsRef.current) return
      connectingRef.current = true

      console.log('🔌 connecting WS', url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        connectingRef.current = false
        console.log('✅ WS connected to room', roomId)
      }

      ws.onmessage = ev => {
        const handler = handlerRef.current
        try {
          handler(JSON.parse(ev.data))
        } catch {
          handler(ev.data)
        }
      }

      ws.onclose = ev => {
        wsRef.current = null
        connectingRef.current = false
        console.warn('⚠️ WS closed', ev.code, ev.reason)

        // If we are intentionally closing (unmount/navigation), do not retry
        if (closingRef.current) return

        // Normal close (1000) often happens when a render recreated the socket.
        // Backoff reconnect to avoid rapid thrash.
        cleanupTimer()
        const delay = 1500
        retryRef.current = window.setTimeout(connect, delay)
      }

      ws.onerror = err => {
        console.error('❌ WS error', err)
        // Let onclose handle the retry/backoff
        try { ws.close() } catch {}
      }
    }

    connect()

    return () => {
      closingRef.current = true
      cleanupTimer()
      const s = wsRef.current
      wsRef.current = null
      if (s && s.readyState === WebSocket.OPEN) {
        s.close(1000, 'unmount')
      } else if (s && s.readyState === WebSocket.CONNECTING) {
        // Best-effort cancel during CONNECTING
        try { s.close() } catch {}
      }
    }
    // IMPORTANT: do NOT depend on onMessage here — it causes recreate loops
  }, [roomId, token])

  const send = (payload: any) => {
    const s = wsRef.current
    if (s && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(payload))
    }
  }

  return {
    sendMessage: send,
    sendTyping: (typing: boolean) => send({ type: typing ? 'typing' : 'stopped_typing' }),
    sendFocus: () => send({ type: 'focus' }),
  }
}
