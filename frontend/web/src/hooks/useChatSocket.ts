// src/hooks/useChatSocket.ts
// =============================================================
// TuChati WebSocket Hook (stable)
// Handles real-time connection to Django Channels backend
// =============================================================
import { useEffect, useRef } from 'react'

type Handler = (data: any) => void

const WS_TEMPLATE = import.meta.env.VITE_WS_URL || ''

function buildWsUrl(roomId: string, token: string) {
  if (WS_TEMPLATE && WS_TEMPLATE.includes(':roomId')) {
    return WS_TEMPLATE.replace(':roomId', roomId) + `?token=${encodeURIComponent(token)}`
  }
  const isHttps = window.location.protocol === 'https:'
  const proto = isHttps ? 'wss' : 'ws'
  const host = window.location.host // includes port if any
  return `${proto}://${host.replace(/:\d+$/, '')}:8011/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`
}

// Optional: separate hook for general invitation socket
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

// -------------------------------------------------------------
// Main chat WebSocket hook
// -------------------------------------------------------------
export function useChatSocket(roomId: string, token: string, onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const closedRef = useRef(false)

  useEffect(() => {
    if (!roomId || !token) return

    const url = buildWsUrl(roomId, token)
    closedRef.current = false

    const connect = () => {
      if (closedRef.current) return
      console.log('🔌 connecting WS', url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WS connected to room', roomId)
      }

      ws.onmessage = ev => {
        try {
          const data = JSON.parse(ev.data)
          onMessage(data)
        } catch {
          onMessage(ev.data)
        }
      }

      ws.onclose = ev => {
        console.warn('⚠️ WS closed', ev.code, ev.reason)
        wsRef.current = null
        if (!closedRef.current) {
          retryRef.current = window.setTimeout(connect, 3000)
        }
      }

      ws.onerror = err => {
        console.error('❌ WS error', err)
        ws.close()
      }
    }

    connect()

    return () => {
      closedRef.current = true
      if (retryRef.current) window.clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [roomId, token, onMessage])

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
