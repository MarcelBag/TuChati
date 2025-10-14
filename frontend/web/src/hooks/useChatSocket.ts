// hooks/useChatSocket.ts
// Single-bind WebSocket with handler ref, typing throttle, and safe reconnects.

import * as React from 'react'

type WSLike = WebSocket | null

export type ChatSocket = {
  sendMessage: (payload: any) => void
  sendTyping: (typing: boolean, fromUser?: string) => void
  isConnected: boolean
}

function makeWsUrl(roomId: string, token: string) {
  const base = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (base) {
    const u = new URL(base.replace(/\/+$/, '') + `/ws/chat/${roomId}/`)
    if (token) u.searchParams.set('token', token)
    return u.toString()
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host  = window.location.host
  const u = new URL(`${proto}//${host}/ws/chat/${roomId}/`)
  if (token) u.searchParams.set('token', token)
  return u.toString()
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

  // reconnection state
  const retryRef = React.useRef(0)
  const reconnectTimer = React.useRef<number | null>(null)

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }

  const connect = React.useCallback(() => {
    if (!roomId || !token) return
    try {
      const ws = new WebSocket(makeWsUrl(roomId, token))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryRef.current = 0
        clearReconnectTimer()
        // Ask server for history on initial open (idempotent on server)
        try { ws.send(JSON.stringify({ type: 'history' })) } catch {}
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        // Exponential backoff reconnect
        const n = Math.min(retryRef.current + 1, 6) // cap ~64s
        retryRef.current = n
        clearReconnectTimer()
        reconnectTimer.current = window.setTimeout(connect, Math.pow(2, n) * 500) // 0.5s,1s,2s,...
      }

      ws.onerror = () => {
        // treat like close to trigger retry
        try { ws.close() } catch {}
      }

      // IMPORTANT: single binding that always calls the latest handler
      ws.onmessage = (ev) => {
        let data: any
        try { data = JSON.parse(ev.data) } catch { return }
        cbRef.current?.(data)
      }
    } catch {
      // schedule another try if constructor failed
      setIsConnected(false)
      const n = Math.min(retryRef.current + 1, 6)
      retryRef.current = n
      clearReconnectTimer()
      reconnectTimer.current = window.setTimeout(connect, Math.pow(2, n) * 500)
    }
  }, [roomId, token])

  // (re)connect when room/token changes
  React.useEffect(() => {
    // close any existing
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setIsConnected(false)
    retryRef.current = 0
    clearReconnectTimer()
    if (roomId && token) connect()
    return () => {
      clearReconnectTimer()
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

  // public API
  const sendMessage = React.useCallback((payload: any) => {
    // payload can be: {content, _client_id} or {type:'reaction',...} etc.
    sendRaw(payload)
  }, [sendRaw])

  // throttle typing events to avoid storms
  const typingTimer = React.useRef<number | null>(null)
  const sendTyping = React.useCallback((typing: boolean, fromUser?: string) => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      sendRaw({ type: 'typing', typing, from_user: fromUser })
    }, 120)
  }, [sendRaw])

  return { sendMessage, sendTyping, isConnected }
}
