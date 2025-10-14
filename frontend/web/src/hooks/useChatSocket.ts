// Single-bind WebSocket with handler ref, typing throttle, heartbeat,
// and safe reconnects that ALWAYS use a fresh access token.

import * as React from 'react'
import { ensureFreshAccess } from '../shared/api'

type WSLike = WebSocket | null

export type ChatSocket = {
  sendMessage: (payload: any) => void
  sendTyping: (typing: boolean, fromUser?: string) => void
  isConnected: boolean
}

function makeWsUrl(roomId: string, token: string) {
  // Accept either VITE_WS_URL or VITE_WS_BASE_URL
  const env: any = import.meta.env
  const base =
    (env.VITE_WS_URL as string | undefined) ||
    (env.VITE_WS_BASE_URL as string | undefined)

  if (base) {
    const u = new URL(base.replace(/\/+$/, '') + `/ws/chat/${encodeURIComponent(roomId)}/`)
    if (token) u.searchParams.set('token', token)
    return u.toString()
  }

  // Fallback to same host as app
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const u = new URL(`${proto}//${host}/ws/chat/${encodeURIComponent(roomId)}/`)
  if (token) u.searchParams.set('token', token)
  return u.toString()
}

export function useChatSocket(
  roomId: string,
  _tokenIgnored: string,               // we intentionally ignore any prop token
  onEvent: (data: any) => void
): ChatSocket {
  const wsRef = React.useRef<WSLike>(null)
  const cbRef = React.useRef(onEvent)
  cbRef.current = onEvent

  const [isConnected, setIsConnected] = React.useState(false)

  // reconnect/heartbeat timers
  const retryRef = React.useRef(0)
  const reconnectTimer = React.useRef<number | null>(null)
  const heartbeatTimer = React.useRef<number | null>(null)

  const clearTimer = (t: React.MutableRefObject<number | null>) => {
    if (t.current) { window.clearTimeout(t.current); t.current = null }
  }

  const scheduleHeartbeat = React.useCallback(() => {
    clearTimer(heartbeatTimer)
    // Send a ping every 25s to keep proxies/load balancers from idling us out
    heartbeatTimer.current = window.setTimeout(() => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }))
        }
      } catch {}
      scheduleHeartbeat()
    }, 25000)
  }, [])

  const connect = React.useCallback(async () => {
    if (!roomId) return

    // Always obtain a fresh access token before connecting/reconnecting.
    const fresh = await ensureFreshAccess()
    if (!fresh) { setIsConnected(false); return }

    try {
      const ws = new WebSocket(makeWsUrl(roomId, fresh))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryRef.current = 0
        clearTimer(reconnectTimer)
        scheduleHeartbeat()

        // Ask server for history on initial open (safe if backend ignores)
        try { ws.send(JSON.stringify({ type: 'history' })) } catch {}
        // Optional: explicit join (safe if backend ignores)
        try { ws.send(JSON.stringify({ type: 'join', room_id: roomId })) } catch {}
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        clearTimer(heartbeatTimer)
        // Exponential backoff, capped
        const n = Math.min(retryRef.current + 1, 6) // ~0.5..32s
        retryRef.current = n
        clearTimer(reconnectTimer)
        reconnectTimer.current = window.setTimeout(() => { void connect() }, Math.pow(2, n) * 500)
      }

      ws.onerror = () => {
        // Treat as close to drive reconnect path
        try { ws.close() } catch {}
      }

      ws.onmessage = (ev) => {
        let data: any
        try { data = JSON.parse(ev.data) } catch { return }
        cbRef.current?.(data)
      }
    } catch {
      setIsConnected(false)
      const n = Math.min(retryRef.current + 1, 6)
      retryRef.current = n
      clearTimer(reconnectTimer)
      reconnectTimer.current = window.setTimeout(() => { void connect() }, Math.pow(2, n) * 500)
    }
  }, [roomId, scheduleHeartbeat])

  // (re)connect when room changes
  React.useEffect(() => {
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setIsConnected(false)
    retryRef.current = 0
    clearTimer(reconnectTimer)
    clearTimer(heartbeatTimer)

    if (roomId) { void connect() }

    return () => {
      clearTimer(reconnectTimer)
      clearTimer(heartbeatTimer)
      try { wsRef.current?.close() } catch {}
      wsRef.current = null
    }
  }, [roomId, connect])

  // stable senders
  const sendRaw = React.useCallback((obj: any) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }, [])

  const sendMessage = React.useCallback((payload: any) => { sendRaw(payload) }, [sendRaw])

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
