// frontend/web/src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room
// - day separators + grouping
// - reactions + typing indicator
// - voice notes w/ optimistic temp bubble (replaced on upload success)
// - de-duped WS events (pairs with hooks/useChatSocket.ts)
// ============================================================

import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch, resolveUrl } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { ChatRoom as Room } from '../types'
import './ChatRoom.css'
import ReactionsBar from '../components/Chat/ReactionsBar'
import VoiceMessage from '../components/Chat/VoiceMessage'

function formatDayLabel(d: Date) {
  const now = new Date()
  const one = 24 * 60 * 60 * 1000
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const nd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((dd - nd) / one)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString()
}

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

export default function ChatRoom() {
  const { roomId } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = React.useState<Room | any>(null)
  const [messages, setMessages] = React.useState<any[]>([])
  const [historyLoaded, setHistoryLoaded] = React.useState(false)
  const [typingUser, setTypingUser] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [showInfo, setShowInfo] = React.useState(false)
  const [showAttach, setShowAttach] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [reactAnchor, setReactAnchor] = React.useState<{ id: string | number | null, x: number, y: number } | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // inputs
  const docRef = React.useRef<HTMLInputElement>(null)
  const mediaRef = React.useRef<HTMLInputElement>(null)
  const audioRef = React.useRef<HTMLInputElement>(null)
  const vcardRef = React.useRef<HTMLInputElement>(null)

  // recorder
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

  // helpers
  const displayName = (user as any)?.name || (user as any)?.username || 'Me'
  const mkClientId = () => `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`

  React.useEffect(() => { setHistoryLoaded(false); setMessages([]) }, [roomId])

  React.useEffect(() => {
    if (!roomId || !token) return
    ;(async () => {
      const r = await apiFetch(`/api/chat/rooms/${roomId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) setRoom(await r.json())
      else navigate('/chat')
    })()
  }, [roomId, token, navigate])

  // Normalizer
  const normalizeMsg = React.useCallback((raw: any) => {
    const text = raw.content ?? raw.message ?? raw.text ?? raw.body ?? ''
    const senderId = raw.sender?.id ?? raw.sender_id ?? raw.sender ?? null
    const reactions = raw.reactions ?? {} // { "👍": [userIds], "❤️": [userIds] }
    const attachment = resolveUrl(raw.attachment ?? raw.file ?? null)
    const audio = resolveUrl(raw.audio ?? raw.voice_note ?? raw.voice ?? null)
    return {
      id: raw.id ?? raw.uuid ?? `${raw.created_at || Date.now()}-${Math.random()}`,
      _client_id: raw._client_id,
      sender_id: senderId,
      sender_name: raw.sender_name ?? raw.sender?.name ?? raw.sender?.username ?? raw.username ?? 'U',
      text,
      attachment,
      audio,
      created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      is_me: !!senderId && senderId === (user?.id as any),
      reactions,
    } as any
  }, [user?.id])

  const mergeMessage = React.useCallback((payload: any) => {
    if (!payload) return
    const normalized = { ...payload }
    if (!!normalized.sender_id && normalized.sender_id === (user?.id as any)) {
      normalized.is_me = true
    }

    setMessages(prev => {
      const candidateKeys = [normalized.id, normalized._client_id].filter(Boolean)
      if (!candidateKeys.length) {
        return [...prev, normalized]
      }

      const idx = prev.findIndex((m: any) => {
        const keys = [m.id, m._client_id].filter(Boolean)
        return candidateKeys.some(key => keys.includes(key))
      })

      if (idx !== -1) {
        const existing = prev[idx]
        const updated = { ...existing, ...normalized }
        if (!!existing.sender_id && existing.sender_id === (user?.id as any)) {
          updated.is_me = true
        }
        if (!!normalized.sender_id && normalized.sender_id === (user?.id as any)) {
          updated.is_me = true
        }
        const next = prev.slice()
        next[idx] = updated
        return next
      }

      return [...prev, normalized]
    })
  }, [user?.id])

  // ---- WebSocket incoming handler (stable) ----
  const handleIncoming = React.useCallback((data: any) => {
    switch (data.type) {
      case 'history': {
        setMessages(prev => {
          if (historyLoaded || prev.length) return prev
          const list = (data.messages || []).map(normalizeMsg)
          return list
        })
        setHistoryLoaded(true)
        return
      }
      case 'typing':
        setTypingUser(data.typing ? (data.from_user || 'Someone') : null)
        return
      case 'reaction': {
        const { message_id, emoji, user_id, op } = data
        setMessages(prev => prev.map((m: any) => {
          if ((m.id ?? m._client_id) !== message_id) return m
          const current = { ...(m.reactions || {}) }
          const arr = new Set<string>(current[emoji] || [])
          op === 'remove' ? arr.delete(String(user_id)) : arr.add(String(user_id))
          current[emoji] = Array.from(arr)
          return { ...m, reactions: current }
        }))
        return
      }
      default: {
        const payload = normalizeMsg(data)
        mergeMessage(payload)
        return
      }
    }
  }, [normalizeMsg, historyLoaded, mergeMessage])

  const { sendMessage, sendTyping } = useChatSocket(roomId || '', token || '', handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  // ---- Send text ----
  const onSend = () => {
    const text = draft.trim(); if (!text) return
    const _client_id = mkClientId()
    const optimistic: any = {
      id: _client_id, _client_id,
      sender_id: user?.id, sender_name: displayName,
      text, created_at: new Date().toISOString(), is_me: true, reactions: {},
    }
    setMessages(prev => [...prev, optimistic])
    sendMessage({ content: text, _client_id })
    setDraft('')
    try { sendTyping(false, displayName) } catch {}
  }

  // ---- Reactions (optimistic + WS) ----
  const toggleReaction = (messageId: string | number, emoji: string) => {
    const uid = String(user?.id ?? 'me')
    setMessages(prev => prev.map((m: any) => {
      if ((m.id ?? m._client_id) !== messageId) return m
      const current = { ...(m.reactions || {}) }
      const set = new Set<string>(current[emoji] || [])
      set.has(uid) ? set.delete(uid) : set.add(uid)
      current[emoji] = Array.from(set)
      return { ...m, reactions: current }
    }))
    try { sendMessage({ type: 'reaction', message_id: messageId, emoji }) } catch {}
  }

  // ---- Uploads (with temp bubble replacement) ----
  async function postFD(fd: FormData, tempId?: string) {
    if (!token || !roomId) return
    const audio = fd.get('audio')
    if (audio instanceof Blob && 'size' in audio && audio.size > MAX_UPLOAD_BYTES) {
      alert('Audio is larger than 3 MB. Please choose a smaller file.')
      return
    }
    const attachment = fd.get('attachment')
    if (attachment instanceof File && attachment.size > MAX_UPLOAD_BYTES) {
      alert('Attachment is larger than 3 MB. Please choose a smaller file.')
      return
    }
    setUploading(true)
    try {
      const r = await apiFetch(`/api/chat/rooms/${roomId}/messages/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (r.ok) {
        const saved = normalizeMsg(await r.json())
        const payload = tempId ? { ...saved, _client_id: tempId } : saved
        if (payload.text || payload.attachment || payload.audio) {
          mergeMessage(payload)
        }
      } else {
        let message = 'Upload failed.'
        try {
          const err = await r.json()
          message = err?.audio || err?.attachment || err?.detail || message
        } catch {}
        alert(message)
      }
    } finally {
      setUploading(false)
    }
  }

  // Documents / Media — optimistic preview using object URL (optional but nice)
  const onDocPicked = async (e: any) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      alert('Attachment is larger than 3 MB. Please choose a smaller file.')
      return
    }
    const _client_id = mkClientId()
    const blobUrl = URL.createObjectURL(f)
    // temp bubble
    setMessages(prev => [...prev, {
      id: _client_id, _client_id, is_me: true, sender_id: user?.id, sender_name: displayName,
      text: '', attachment: blobUrl, audio: null,
      created_at: new Date().toISOString(), reactions: {}
    }])
    const fd = new FormData(); fd.append('attachment', f); fd.append('_client_id', _client_id)
    await postFD(fd, _client_id)
    // allow GC of blob URL later (keep visible for a while)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  }

  const onMediaPicked = async (e: any) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      alert('Attachment is larger than 3 MB. Please choose a smaller file.')
      return
    }
    const _client_id = mkClientId()
    const blobUrl = URL.createObjectURL(f)
    setMessages(prev => [...prev, {
      id: _client_id, _client_id, is_me: true, sender_id: user?.id, sender_name: displayName,
      text: '', attachment: blobUrl, audio: null,
      created_at: new Date().toISOString(), reactions: {}
    }])
    const fd = new FormData(); fd.append('attachment', f); fd.append('_client_id', _client_id)
    await postFD(fd, _client_id)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  }

  const onAudioPicked = async (e: any) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      alert('Audio is larger than 3 MB. Please choose a smaller file.')
      return
    }
    const _client_id = mkClientId()
    const blobUrl = URL.createObjectURL(f)
    setMessages(prev => [...prev, {
      id: _client_id, _client_id, is_me: true, sender_id: user?.id, sender_name: displayName,
      text: '', attachment: null, audio: blobUrl,
      created_at: new Date().toISOString(), reactions: {}
    }])
    const fd = new FormData(); fd.append('audio', f); fd.append('_client_id', _client_id)
    await postFD(fd, _client_id)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  }

  const pickContact = async () => {
    // @ts-ignore
    if (navigator?.contacts?.select) {
      try {
        // @ts-ignore
        const [contact] = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false })
        if (contact) {
          const _client_id = mkClientId()
          const fd = new FormData()
          fd.append('contact_json', new Blob([JSON.stringify(contact)], { type: 'application/json' }))
          fd.append('_client_id', _client_id)
          await postFD(fd, _client_id)
          return
        }
      } catch {}
    }
    vcardRef.current?.click()
  }

  // ---- Voice recorder (temp bubble + replace on save) ----
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size > MAX_UPLOAD_BYTES) {
          alert('Audio is larger than 3 MB. Please record a shorter clip.')
          return
        }
        const blobUrl = URL.createObjectURL(blob)
        const _client_id = mkClientId()

        // optimistic audio bubble
        setMessages(prev => [...prev, {
          id: _client_id, _client_id, is_me: true,
          sender_id: user?.id, sender_name: displayName,
          text: '', attachment: null, audio: blobUrl,
          created_at: new Date().toISOString(), reactions: {}
        }])

        const fd = new FormData()
        fd.append('audio', blob, `voice-${Date.now()}.webm`)
        fd.append('_client_id', _client_id)
        await postFD(fd, _client_id)

        // release object URL later
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); mediaRecorderRef.current = null; setIsRecording(false) }

  // ---- Context menu (3-dots) ----
  const isGroup = !!room?.is_group
  const isAdmin = !!room?.is_admin || (Array.isArray(room?.admin_ids) && room.admin_ids.includes(user?.id as any))
  const goInvite = () => navigate(`/chat/${roomId}/invite`)
  if (!token) return null

  // ---- Render list with grouping + day separators ----
  type RenderItem =
    | { kind: 'day'; id: string; label: string }
    | { kind: 'msg'; id: string; mine: boolean; showAvatar: boolean; showTail: boolean; m: any }

  const renderItems: RenderItem[] = []
  let lastDayKey = ''
  let prevSender: any = null
  const filtered = messages.filter((m: any) => !!(m.text || m.attachment || m.audio))

  filtered.forEach((m: any, i: number) => {
    const date = new Date(m.created_at || Date.now())
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (dayKey !== lastDayKey) {
      renderItems.push({ kind: 'day', id: `day-${dayKey}`, label: formatDayLabel(date) })
      lastDayKey = dayKey
      prevSender = null
    }
    const curSender = m.is_me ? 'me' : (m.sender_id ?? 'other')
    const next = filtered[i + 1]
    const nextSender = next ? (next.is_me ? 'me' : (next.sender_id ?? 'other')) : null
    const showAvatar = curSender !== prevSender
    const showTail = curSender !== nextSender
    prevSender = curSender
    renderItems.push({
      kind: 'msg',
      id: m.id ?? m._client_id ?? `k-${m.created_at}-${i}`,
      mine: !!m.is_me || m.sender_id === user?.id,
      showAvatar,
      showTail,
      m,
    })
  })

  return (
    <>
      <header className="chat-hd">
        <div className="title">
          <div className="avatar-badge lg">{(room?.name || 'R').slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="name" onClick={() => setShowInfo(s => !s)} style={{ cursor: isGroup ? 'pointer' : undefined }}>
              {room?.name || 'Room'} {isGroup && <span className="ri-tip">(tap for info)</span>}
            </div>
            <div className="sub">
              {typingUser ? `${typingUser} is typing…` : (isGroup ? 'Group chat' : 'Direct chat')}
            </div>
          </div>
        </div>
      </header>

      <div className="chat-scroll" ref={listRef}>
        {renderItems.map((it, idx) => {
          if (it.kind === 'day') return <div key={it.id} className="day-sep"><span>{it.label}</span></div>
        const { m, mine, showAvatar, showTail } = it
        const key = it.id || idx
        const messageId = (m.id ?? m._client_id)

        // counts for reaction chips
        const reactionPairs = Object.entries(m.reactions || {}).filter(([, arr]) => Array.isArray(arr) && arr.length > 0)

        return (
          <div key={key} className={`row ${mine ? 'right' : 'left'}`}>
            {!mine && showAvatar && (
              <div className="avatar-badge sm">{(m.sender_name || 'U').slice(0, 1).toUpperCase()}</div>
            )}

            <div className={`bubble ${mine ? 'me' : 'other'} ${showTail ? 'tail' : ''}`}>
              {/* kebab / more icon */}
              <button
                className="more"
                aria-label="Message actions"
                onClick={(e) => {
                  e.stopPropagation()
                  setCtx({ open: true, x: e.clientX, y: e.clientY, id: key, mine })
                }}
              >
                ⋯
              </button>

              {/* text / attachments */}
              {m.text && <p>{m.text}</p>}
              {m.attachment && <a className="attach" href={m.attachment} target="_blank" rel="noreferrer">Attachment</a>}
              {m.audio && <VoiceMessage src={m.audio} />}

              {/* timestamp */}
              <span className="time">
                {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>

              {/* reactions summary chips */}
              {reactionPairs.length > 0 && (
                <div className="rxn-chips">
                  {reactionPairs.map(([emoji, arr]: any) => (
                    <span key={`${emoji}`} className="rxn-chip">{emoji} {arr.length}</span>
                  ))}
                </div>
              )}

              {/* quick reactions trigger (smiley button) */}
              <button
                className="react-btn"
                aria-label="React"
                onClick={(e) => {
                  e.stopPropagation()
                  setReactAnchor({ id: messageId, x: e.clientX, y: e.clientY })
                }}
              >☺</button>
            </div>
          </div>
        )
      })}
      </div>

      <footer className="composer">
        <div className="composer-left">
          <button className="icon-btn" onClick={() => setShowAttach(s => !s)}>＋</button>
          {showAttach && (
            <div className="attach-menu">
              <button className="attach-item" onClick={() => docRef.current?.click()}>📄 Document</button>
              <button className="attach-item" onClick={() => mediaRef.current?.click()}>🖼️ Photos & Videos</button>
              <button className="attach-item" onClick={() => audioRef.current?.click()}>🎧 Audio</button>
              <button className="attach-item" onClick={pickContact}>👤 Contact</button>
            </div>
          )}
          <input ref={docRef} type="file" onChange={onDocPicked} hidden />
          <input ref={mediaRef} type="file" accept="image/*,video/*" onChange={onMediaPicked} hidden />
          <input ref={audioRef} type="file" accept="audio/*" onChange={onAudioPicked} hidden />
          <input ref={vcardRef} type="file" accept=".vcf,text/vcard" hidden />
        </div>

        <input
          value={draft}
          onChange={e => { setDraft(e.target.value); try { sendTyping(true, displayName) } catch {} }}
          onBlur={() => { try { sendTyping(false, displayName) } catch {} }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder={uploading ? 'Uploading…' : (isRecording ? 'Recording…' : 'Type a message')}
          disabled={uploading}
        />

        {draft.trim().length > 0 ? (
          <button className="send" onClick={onSend}>➤</button>
        ) : (
          <button className={`send mic ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? '■' : '🎙️'}
          </button>
        )}
      </footer>

      {/* group info */}
      {isGroup && (
        <aside className={`room-info ${showInfo ? 'open' : ''}`}>
          <div className="room-info-hd">
            <div className="avatar-badge lg">{(room?.name || 'R').slice(0, 1).toUpperCase()}</div>
            <div className="ri-meta">
              <h4>{room?.name}</h4>
              <p>{room?.member_count ?? room?.members?.length ?? 0} members</p>
            </div>
            <button className="ri-close" onClick={() => setShowInfo(false)}>✕</button>
          </div>
          <div className="ri-section">
            <div className="ri-title">Members</div>
            <ul className="ri-list">
              {room?.members?.map((m: any) => (
                <li key={m.id}>
                  <span className="ri-avatar">{(m.name || m.username || 'U').slice(0, 1)}</span>
                  <span className="ri-name">{m.name || m.username || m.email}</span>
                </li>
              ))}
            </ul>
            {isAdmin && <button className="btn small" onClick={goInvite}>+ Invite</button>}
          </div>
        </aside>
      )}

      {/* quick reactions popover */}
      {reactAnchor && (
        <ReactionsBar
          x={reactAnchor.x}
          y={reactAnchor.y}
          onPick={(emoji) => {
            if (!reactAnchor?.id) return
            toggleReaction(reactAnchor.id, emoji)
            setReactAnchor(null)
          }}
          onClose={() => setReactAnchor(null)}
        />
      )}
    </>
  )
}
