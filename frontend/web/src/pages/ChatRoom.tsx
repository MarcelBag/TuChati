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

  const handleIncoming = (data: any) => {
    if (data.type === 'history') setMessages(data.messages || [])
    else if (data.type === 'typing') setTypingUser(data.typing ? data.from_user : null)
    else if (data.sender && (data.content || data.attachment || data.audio)) {
      setMessages(prev => [...prev, data])
    }
  }

  const { sendMessage, sendTyping } = useChatSocket(roomId || '', token || '', handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

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
        // server usually broadcasts, but add optimistic append if it returned the message
        try {
          const m = await r.json()
          if (m && (m.content || m.attachment || m.audio)) {
            setMessages(prev => [...prev, m])
          }
        } catch {}
      }
    } finally {
      setUploading(false)
    }
  }

  const onSend = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage({ content: text })
    setDraft('')
  }

  // ---- attach handlers
  const onDocPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('attachment', f)
    await postFD(fd); e.target.value = ''
  }
  const onMediaPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('attachment', f)
    await postFD(fd); e.target.value = ''
  }
  const onCamPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('attachment', f)
    await postFD(fd); e.target.value = ''
  }
  const onAudioPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('audio', f)
    await postFD(fd); e.target.value = ''
  }
  const onVcardPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('contact', f)
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

  // ---- voice note recording
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
        {/* left: + */}
        <div className="composer-left">
          <button
            className="icon-btn"
            onClick={() => setShowAttach(s => !s)}
            aria-label="Add"
            title="Add"
          >＋</button>

          {showAttach && (
            <div className="attach-menu" onMouseLeave={() => setShowAttach(false)}>
              <button className="attach-item" onClick={() => docRef.current?.click()}>
                <span className="ico">📄</span><span>Document</span>
              </button>
              <button className="attach-item" onClick={() => mediaRef.current?.click()}>
                <span className="ico">🖼️</span><span>Photos & Videos</span>
              </button>
              <button className="attach-item" onClick={() => camRef.current?.click()}>
                <span className="ico">📷</span><span>Camera</span>
              </button>
              <button className="attach-item" onClick={() => audioRef.current?.click()}>
                <span className="ico">🎧</span><span>Audio</span>
              </button>
              <button className="attach-item" onClick={pickContact}>
                <span className="ico">👤</span><span>Contact</span>
              </button>

              {/* future routes */}
              <button className="attach-item" onClick={() => navigate(`/chat/${roomId}/poll/new`)}>
                <span className="ico">📊</span><span>Poll</span>
              </button>
              <button className="attach-item" onClick={() => navigate(`/chat/${roomId}/event/new`)}>
                <span className="ico">🗓️</span><span>Event</span>
              </button>
              <button className="attach-item" onClick={() => navigate(`/chat/${roomId}/sticker/new`)}>
                <span className="ico">🧩</span><span>New Sticker</span>
              </button>
              <button className="attach-item" onClick={() => navigate(`/chat/${roomId}/catalog`)}>
                <span className="ico">🗂️</span><span>Catalog</span>
              </button>
              <button className="attach-item" onClick={() => navigate(`/chat/${roomId}/quick-replies`)}>
                <span className="ico">⚡</span><span>Quick replies</span>
              </button>
            </div>
          )}

          {/* hidden inputs */}
          <input ref={docRef} type="file" onChange={onDocPicked} hidden />
          <input ref={mediaRef} type="file" accept="image/*,video/*" onChange={onMediaPicked} hidden />
          <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" onChange={onCamPicked} hidden />
          <input ref={audioRef} type="file" accept="audio/*" onChange={onAudioPicked} hidden />
          <input ref={vcardRef} type="file" accept=".vcf,text/vcard" onChange={onVcardPicked} hidden />
        </div>

        {/* middle input */}
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

        {/* right: send / mic */}
        {draft.trim().length > 0 ? (
          <button className="send" onClick={onSend} aria-label="Send">➤</button>
        ) : (
          <button
            className={`send mic ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
            title={isRecording ? 'Stop recording' : 'Record voice note'}
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
            <button className="ri-close" onClick={() => setShowInfo(false)} aria-label="Close info">✕</button>
          </div>

          <div className="ri-section">
            <div className="ri-title">Members</div>
            <ul className="ri-list">
              {room?.members?.map((m: any) => (
                <li key={m.id}>
                  <span className="ri-avatar">{(m.name || m.username || 'U').slice(0, 1)}</span>
                  <span className="ri-name">{m.name || m.username || m.email}</span>
                  {isAdmin && m.id !== user?.id && (
                    <button
                      className="ri-action"
                      onClick={async () => {
                        await apiFetch(`/api/chat/rooms/${roomId}/members/${m.id}/`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        setRoom((prev: any) =>
                          prev ? { ...prev, members: prev.members.filter((x: any) => x.id !== m.id) } : prev
                        )
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            
            <button className="btn small" onClick={goInvite}>+ Invite</button>
          </div>

          {isAdmin ? (
            <div className="ri-section">
              <div className="ri-title">Admin tools</div>
              <div className="ri-actions">
                <button
                  className="btn small"
                  onClick={async () => {
                    const name = prompt('Rename group', room?.name || '')
                    if (!name) return
                    await apiFetch(`/api/chat/rooms/${roomId}/`, {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name }),
                    })
                    setRoom((prev: any) => (prev ? { ...prev, name } : prev))
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn small"
                  onClick={async () => {
                    if (!confirm('Delete this group?')) return
                    await apiFetch(`/api/chat/rooms/${roomId}/`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    navigate('/chat')
                  }}
                >
                  Delete group
                </button>
              </div>
            </div>
          ) : (
            <div className="ri-section">
              <div className="ri-title">Actions</div>
              <button
                className="btn small"
                onClick={async () => {
                  if (!confirm('Leave this group?')) return
                  await apiFetch(`/api/chat/rooms/${roomId}/leave/`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  navigate('/chat')
                }}
              >
                Leave group
              </button>
            </div>
          )}
        </aside>
      )}
    </>
  )
}
