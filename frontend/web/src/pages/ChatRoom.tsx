// ============================================================
// TuChati Chat Room – full width inside ChatPage + attach menu
// ============================================================
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { ChatRoom as Room, ChatMessage } from '../types'
import './ChatRoom.css'

export default function ChatRoom() {
  const { roomId } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = React.useState<Room | any>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [typingUser, setTypingUser] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [showInfo, setShowInfo] = React.useState(false)
  const [showAttach, setShowAttach] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  // file inputs
  const docRef = React.useRef<HTMLInputElement>(null)
  const mediaRef = React.useRef<HTMLInputElement>(null)
  const camRef = React.useRef<HTMLInputElement>(null)
  const audioRef = React.useRef<HTMLInputElement>(null)
  const vcardRef = React.useRef<HTMLInputElement>(null)

  // media recorder
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

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

  // Handle all WebSocket events (messages, system, invites)
  const handleIncoming = (data: any) => {
    switch (data.type) {
      case 'history':
        setMessages(data.messages || [])
        break
      case 'typing':
        setTypingUser(data.typing ? data.from_user : null)
        break
      case 'system_message':
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            sender: 'system',
            content: data.message,
            created_at: data.timestamp,
          },
        ])
        break
      case 'invitation':
        alert(`${data.invited_by} added you to ${data.room_name}`)
        break
      default:
        if (data.sender && (data.content || data.attachment || data.audio)) {
          setMessages(prev => [...prev, data])
        }
    }
  }

  const { sendMessage, sendTyping } = useChatSocket(roomId || '', token || '', handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  // Send new message
  const onSend = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage({ content: text })
    setDraft('')
  }

  // Upload file helper
  const postFD = async (fd: FormData) => {
    if (!token || !roomId) return
    setUploading(true)
    try {
      const r = await apiFetch(`/api/chat/rooms/${roomId}/messages/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (r.ok) {
        const m = await r.json()
        if (m && (m.content || m.attachment || m.audio)) {
          setMessages(prev => [...prev, m])
        }
      }
    } finally {
      setUploading(false)
    }
  }

  // Input + attachment handlers
  const onDocPicked = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('attachment', f)
    await postFD(fd); e.target.value = ''
  }

  const onMediaPicked = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('attachment', f)
    await postFD(fd); e.target.value = ''
  }

  const onAudioPicked = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('audio', f)
    await postFD(fd); e.target.value = ''
  }

  const pickContact = async () => {
    // @ts-ignore
    if (navigator?.contacts?.select) {
      try {
        // @ts-ignore
        const [contact] = await navigator.contacts.select(['name','tel','email'], { multiple: false })
        if (contact) {
          const fd = new FormData()
          fd.append('contact_json', new Blob([JSON.stringify(contact)], { type: 'application/json' }))
          await postFD(fd)
          return
        }
      } catch {}
    }
    vcardRef.current?.click()
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, `voice-${Date.now()}.webm`)
        await postFD(fd)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch (err) {
      console.error('mic error', err)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  if (!token) return null

  const isGroup = !!room?.is_group
  const isAdmin =
    !!room?.is_admin ||
    (Array.isArray(room?.admin_ids) && room.admin_ids.includes(user?.id as any))

  // invite flow (simple dialog)
  const goInvite = () => navigate(`/chat/${roomId}/invite`)

  return (
    <>
      <header className="chat-hd">
        <div className="title">
          <div className="avatar-badge lg">{(room?.name || 'R').slice(0,1).toUpperCase()}</div>
          <div>
            <div className="name" onClick={() => setShowInfo(s => !s)} style={{cursor:isGroup?'pointer':undefined}}>
              {room?.name || 'Room'} {isGroup && <span className="ri-tip">(tap for info)</span>}
            </div>
            <div className="sub">
              {typingUser ? `${typingUser} is typing…` : (isGroup ? 'Group chat' : 'Direct chat')}
            </div>
          </div>
        </div>
      </header>

      {/* Messages list */}
      <div className="chat-scroll" ref={listRef}>
        {messages.map((m, idx) => {
          const mine = (m as any).sender?.id === user?.id || (m as any).sender === user?.id
          return (
            <div key={(m as any).id || idx} className={`bubble-row ${mine ? 'right' : 'left'}`}>
              {!mine && <div className="avatar-badge sm">{(((m as any).sender_name) || 'U').slice(0,1).toUpperCase()}</div>}
              <div className={`bubble ${mine ? 'me' : ''}`}>
                {(m as any).content && <p>{(m as any).content}</p>}
                {(m as any).attachment && (
                  <a className="attach" href={(m as any).attachment} target="_blank" rel="noreferrer">Attachment</a>
                )}
                {(m as any).audio && (
                  <audio controls src={(m as any).audio} style={{maxWidth: 280, display:'block'}} />
                )}
                <span className="time">
                  {(m as any).created_at
                    ? new Date((m as any).created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
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
          onChange={e => {
            setDraft(e.target.value)
            try { sendTyping?.(true) } catch {}
          }}
          onBlur={() => { try { sendTyping?.(false) } catch {} }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={uploading ? 'Uploading…' : (isRecording ? 'Recording…' : 'Type a message')}
          disabled={uploading}
        />

        {draft.trim().length > 0 ? (
          <button className="send" onClick={onSend}>➤</button>
        ) : (
          <button
            className={`send mic ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? '■' : '🎙️'}
          </button>
        )}
      </footer>

      {/* Right info drawer */}
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
            <button className="btn small" onClick={goInvite}>+ Invite</button>
          </div>
        </aside>
      )}
    </>
  )
}
