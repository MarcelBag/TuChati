// Single-bind WebSocket with handler ref, typing throttle, join, heartbeat, and safe reconnects.

import * as React from 'react'

type WSLike = WebSocket | null

export type ChatSocket = {
  sendMessage: (payload: any) => void
  sendTyping: (typing: boolean, fromUser?: string) => void
  isConnected: boolean
}

function makeWsUrl(roomId: string, token: string) {
  // ENV
  const base = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/+$/, '')
  const paramKey = (import.meta.env.VITE_WS_TOKEN_PARAM as string | undefined) || 'token'

  const qs = token ? `?${encodeURIComponent(paramKey)}=${encodeURIComponent(token)}` : ''

  if (base) return `${base}/ws/chat/${encodeURIComponent(roomId)}${qs}`

  // Fallback to same host as the webapp
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host  = window.location.host
  return `${proto}//${host}/ws/chat/${encodeURIComponent(roomId)}${qs}`
}

export function useChatSocket(
  roomId: string,
  token: string,
  onEvent: (data: any) => void
): ChatSocket {
  const wsRef = React.useRef<WSLike>(null)
  const cbRef = React.useRef(onEvent)
  cbRef.current = onEvent

  const [isConnected, setIsConnected] = React.useState(false)

  const retryRef = React.useRef(0)
  const reconnectTimer = React.useRef<number | null>(null)
  const heartbeatTimer = React.useRef<number | null>(null)

  const clearTimer = (t: React.MutableRefObject<number | null>) => {
    if (t.current) { window.clearTimeout(t.current); t.current = null }
  }

  const scheduleHeartbeat = React.useCallback(() => {
    clearTimer(heartbeatTimer)
    // Send a ping every 25s to keep proxies happy
    heartbeatTimer.current = window.setTimeout(() => {
      try { wsRef.current?.readyState === WebSocket.OPEN && wsRef.current?.send(JSON.stringify({ type: 'ping' })) } catch {}
      scheduleHeartbeat()
    }, 25000)
  }, [])

  const connect = React.useCallback(() => {
    if (!roomId || !token) return
    try {
      const ws = new WebSocket(makeWsUrl(roomId, token))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryRef.current = 0
        clearTimer(reconnectTimer)
        scheduleHeartbeat()
        // Ask history & join explicitly (safe if backend ignores)
        try { ws.send(JSON.stringify({ type: 'history' })) } catch {}
        try { ws.send(JSON.stringify({ type: 'join', room_id: roomId })) } catch {}
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        clearTimer(heartbeatTimer)
        // Exponential backoff
        const n = Math.min(retryRef.current + 1, 6) // cap ~32s
        retryRef.current = n
        clearTimer(reconnectTimer)
        reconnectTimer.current = window.setTimeout(connect, Math.pow(2, n) * 500) // 0.5,1,2,4,8,16,32
      }

      ws.onerror = () => {
        try { ws.close() } catch {}
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          cbRef.current?.(data)
        } catch {}
      }
    } catch {
      setIsConnected(false)
      const n = Math.min(retryRef.current + 1, 6)
      retryRef.current = n
      clearTimer(reconnectTimer)
      reconnectTimer.current = window.setTimeout(connect, Math.pow(2, n) * 500)
    }
  }, [roomId, token, scheduleHeartbeat])

  // (re)connect on changes
  React.useEffect(() => {
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setIsConnected(false)
    retryRef.current = 0
    clearTimer(reconnectTimer)
    clearTimer(heartbeatTimer)

    if (roomId && token) connect()

    return () => {
      clearTimer(reconnectTimer)
      clearTimer(heartbeatTimer)
      try { wsRef.current?.close() } catch {}
      wsRef.current = null
    }
  }, [roomId, token, connect])

  // stable senders
  const sendRaw = React.useCallback((obj: any) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }, [])

  const sendMessage = React.useCallback((payload: any) => { sendRaw(payload) }, [sendRaw])

  // throttle typing events
  const typingTimer = React.useRef<number | null>(null)
  const sendTyping = React.useCallback((typing: boolean, fromUser?: string) => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      sendRaw({ type: 'typing', typing, from_user: fromUser })
    }, 120)
  }, [sendRaw])

  return { sendMessage, sendTyping, isConnected }
}
