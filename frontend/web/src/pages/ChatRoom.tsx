// frontend/web/src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room grouping + day separators + reactions
// Per-bubble "more" chevron to open actions menu
// Emoji reactions; listens for WS 'reaction' events
// (Fixed TDZ/ReferenceError: menuActions; boolean op; ordering)
// ============================================================
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch, resolveUrl } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { ChatRoom as Room } from '../types'
import './ChatRoom.css'
import ReactionsBar, { REACTION_SET } from '../components/Chat/ReactionsBar'
import MessageMenu, { MessageMenuAction } from '../components/Chat/MessageMenu'
import VoiceMessage from '../components/Chat/VoiceMessage'
import MessageInfoModal from '../components/Chat/MessageInfoModal'
import { useChatNotifications } from '../hooks/useChatNotifications'
import { useMediaPreference } from '../context/PreferencesContext'
import { deleteMessage, deleteMessages, fetchMessageInfo, saveNote, setPinned, setStarred } from '../api/chatActions'

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const AUDIO_MIME_CANDIDATES = [
  { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  { mime: 'audio/mpeg', ext: 'mp3' },
]

export default function ChatRoom() {
  const { roomId } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const { playSend, playReceive } = useChatNotifications()

  const [room, setRoom] = React.useState<Room | any>(null)
  const [messages, setMessages] = React.useState<any[]>([])
  const [historyLoaded, setHistoryLoaded] = React.useState(false)
  const [typingUser, setTypingUser] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [showInfo, setShowInfo] = React.useState(false)
  const [showAttach, setShowAttach] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [recordPeaks, setRecordPeaks] = React.useState<number[]>([])
  const [menuState, setMenuState] = React.useState<{ open: boolean; x: number; y: number; message: any | null }>({ open: false, x: 0, y: 0, message: null })
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [composerContext, setComposerContext] = React.useState<{ type: 'reply' | 'forward'; message: any } | null>(null)
  const [infoState, setInfoState] = React.useState<{ open: boolean; loading: boolean; data?: any; messageId?: string }>({ open: false, loading: false })
  const [reactAnchor, setReactAnchor] = React.useState<{ id: string | number | null, x: number, y: number } | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])

  React.useEffect(() => {
    if (selectionMode && selectedIds.length === 0) {
      setSelectionMode(false)
    }
  }, [selectedIds.length, selectionMode])

  const docRef = React.useRef<HTMLInputElement>(null)
  const mediaRef = React.useRef<HTMLInputElement>(null)
  const audioRef = React.useRef<HTMLInputElement>(null)
  const gifRef = React.useRef<HTMLInputElement>(null)
  const vcardRef = React.useRef<HTMLInputElement>(null)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const recorderConfigRef = React.useRef<{ mime: string; ext: string } | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const dataArrayRef = React.useRef<Uint8Array | null>(null)
  const recordAnimationRef = React.useRef<number | null>(null)
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const imagePreference = useMediaPreference('images')
  const videoPreference = useMediaPreference('videos')

  const toggleSelection = React.useCallback((id: string | number | null) => {
    const value = String(id)
    setSelectedIds(prev => (prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]))
  }, [])

  const clearSelection = React.useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
  }, [])

  const enterSelection = React.useCallback((id?: string | number | null) => {
    setSelectionMode(true)
    if (id !== undefined && id !== null) {
      const value = String(id)
      setSelectedIds(prev => (prev.includes(value) ? prev : [...prev, value]))
    }
  }, [])

  const removeMessagesLocal = React.useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return
    const idSet = new Set(ids.map(String))
    setMessages(prev => prev.filter((m: any) => !idSet.has(String(m.id ?? m._client_id))))
    setSelectedIds(prev => prev.filter(id => !idSet.has(id)))
  }, [])

  const handleCopy = React.useCallback((message: any) => {
    const content = message?.text || ''
    if (!content) return
    navigator.clipboard?.writeText(content).catch(() => console.warn('Clipboard copy failed'))
  }, [])

  // --- derive role flags BEFORE anything that uses them ---
  const isGroup = !!room?.is_group
  const isAdmin =
    !!room?.is_admin ||
    (Array.isArray(room?.admin_ids) && room.admin_ids.includes(user?.id as any))

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
    if (!raw) return null
    const text = raw.content ?? raw.message ?? raw.text ?? raw.body ?? ''
    const senderId = raw.sender?.id ?? raw.sender_id ?? raw.sender ?? null
    const reactions = raw.reactions ?? {}
    const attachment = resolveUrl(raw.attachment ?? raw.file ?? null)
    const audio = resolveUrl(raw.audio ?? raw.voice_note ?? raw.voice ?? null)
    const attachmentInfo = raw.attachment_info ?? null

    const mapRef = (ref: any) => {
      if (!ref) return null
      return {
        id: ref.id ?? ref.uuid ?? null,
        sender_id: ref.sender?.id ?? ref.sender_id ?? null,
        sender_name: ref.sender_name ?? ref.sender?.name ?? ref.sender?.username ?? 'U',
        text: ref.content ?? ref.text ?? '',
        attachment: resolveUrl(ref.attachment ?? null),
        audio: resolveUrl(ref.audio ?? null),
        created_at: ref.created_at ?? new Date().toISOString(),
      }
    }

    return {
      id: raw.id ?? raw.uuid ?? `${raw.created_at || Date.now()}-${Math.random()}`,
      _client_id: raw._client_id,
      sender_id: senderId,
      sender_name: raw.sender_name ?? raw.sender?.name ?? raw.sender?.username ?? raw.username ?? 'U',
      text,
      attachment,
      attachment_info: attachmentInfo,
      audio,
      created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      is_me: !!senderId && senderId === (user?.id as any),
      reactions,
      reply_to: mapRef(raw.reply_to ?? raw.reply),
      forwarded_from: mapRef(raw.forwarded_from ?? raw.forwarded),
      pinned: !!raw.pinned,
      pinned_by: raw.pinned_by ?? null,
      starred: !!raw.starred,
      note: raw.note ?? '',
      deleted_for_me: !!raw.deleted_for_me,
      duration: raw.duration ?? null,
    } as any
  }, [user?.id])

  // --- mergeMessage must come BEFORE any callbacks that depend on it ---
  const mergeMessage = React.useCallback((payload: any) => {
    if (!payload) return false
    const normalized = { ...payload }
    if (!!normalized.sender_id && normalized.sender_id === (user?.id as any)) {
      normalized.is_me = true
    }

    if (normalized.deleted_for_me && normalized.id) {
      removeMessagesLocal([normalized.id])
      return true
    }

    let changed = false
    setMessages(prev => {
      const candidateKeys = [normalized.id, normalized._client_id].filter(Boolean)
      if (!candidateKeys.length) {
        changed = true
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
        if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          changed = true
        }
        const next = prev.slice()
        next[idx] = updated
        return next
      }

      changed = true
      return [...prev, normalized]
    })
    return changed
  }, [removeMessagesLocal, user?.id])

  const handlePinToggle = React.useCallback(async (message: any) => {
    if (!roomId || !message?.id) return
    try {
      const next = await setPinned(roomId, message.id, !message.pinned)
      mergeMessage(next)
    } catch (error: any) {
      alert(error?.message || 'Failed to update pin state')
    }
  }, [mergeMessage, roomId])

  const handleStarToggle = React.useCallback(async (message: any) => {
    if (!roomId || !message?.id) return
    try {
      const next = await setStarred(roomId, message.id, !message.starred)
      mergeMessage(next)
    } catch (error: any) {
      alert(error?.message || 'Failed to update star state')
    }
  }, [mergeMessage, roomId])

  const handleNoteEdit = React.useCallback(async (message: any) => {
    if (!roomId || !message?.id) return
    const current = message.note || ''
    const nextNote = window.prompt('Add a note for this message', current)
    if (nextNote === null) return
    try {
      const next = await saveNote(roomId, message.id, nextNote)
      mergeMessage(next)
    } catch (error: any) {
      alert(error?.message || 'Failed to save note')
    }
  }, [mergeMessage, roomId])

  const handleInfo = React.useCallback(async (message: any) => {
    if (!roomId || !message?.id) return
    setInfoState({ open: true, loading: true, messageId: message.id })
    try {
      const data = await fetchMessageInfo(roomId, message.id)
      setInfoState({ open: true, loading: false, data, messageId: message.id })
    } catch (error: any) {
      alert(error?.message || 'Failed to load message info')
      setInfoState({ open: false, loading: false })
    }
  }, [roomId])

  const handleReply = React.useCallback((message: any) => {
    setComposerContext({ type: 'reply', message })
  }, [])

  const handleForward = React.useCallback((message: any) => {
    setComposerContext({ type: 'forward', message })
  }, [])

  const isServerId = React.useCallback((value: any) => typeof value === 'string' && UUID_PATTERN.test(value), [])

  const handleDelete = React.useCallback(async (message: any, scope: 'me' | 'all' = 'me') => {
    const targetId = message?.id ?? message?._client_id
    if (!targetId) return

    const serverId = isServerId(message?.id ? String(message.id) : '') ? String(message.id) : null
    if (!roomId || !serverId) {
      removeMessagesLocal([String(targetId)])
      if (selectionMode) clearSelection()
      return
    }

    try {
      await deleteMessage(roomId, serverId, scope)
      removeMessagesLocal([String(targetId)])
      if (selectionMode) clearSelection()
    } catch (error: any) {
      alert(error?.message || 'Failed to delete message')
    }
  }, [clearSelection, isServerId, removeMessagesLocal, roomId, selectionMode])

  const handleBulkDelete = React.useCallback(async (scope: 'me' | 'all' = 'me') => {
    if (!roomId || selectedIds.length === 0) return

    const serverIds: string[] = []
    const localOnly: string[] = []

    selectedIds.forEach((id) => {
      const msg = messages.find((m: any) => String(m.id) === id || String(m._client_id) === id)
      if (!msg) return
      if (isServerId(msg.id)) serverIds.push(String(msg.id))
      else localOnly.push(String(msg._client_id ?? msg.id))
    })

    try {
      if (scope === 'all') {
        if (serverIds.length === 0) {
          alert('Only delivered messages can be deleted for everyone.')
          return
        }
        await deleteMessages(roomId, serverIds, 'all')
        removeMessagesLocal([...serverIds, ...localOnly])
      } else {
        if (serverIds.length > 0) await deleteMessages(roomId, serverIds, 'me')
        removeMessagesLocal([...serverIds, ...localOnly])
      }
      clearSelection()
    } catch (error: any) {
      alert(error?.message || 'Failed to delete messages')
    }
  }, [clearSelection, isServerId, messages, removeMessagesLocal, roomId, selectedIds])

  type AttachmentRender = {
    node: React.ReactNode | null
    kind: 'none' | 'audio' | 'image' | 'video' | 'file'
  }

  const renderAttachment = React.useCallback((message: any): AttachmentRender => {
    if (!message) return { node: null, kind: 'none' }

    const info = message.attachment_info || {}
    const attachmentUrl = message.attachment || ''
    const audioUrl = message.audio || ''
    const contentType = (info.content_type || '').toLowerCase()
    const filename = info.name || info.filename || info.title || null
    const rawDuration = message.duration
    const numericDuration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration)
    const durationSeconds = Number.isFinite(numericDuration) ? numericDuration : undefined
    const cleanExt = (() => {
      if (!attachmentUrl) return ''
      const withoutQuery = attachmentUrl.split('?')[0]
      const parts = withoutQuery.split('.')
      return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
    })()

    const isImage = !!attachmentUrl && (
      contentType.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'].includes(cleanExt)
    )
    const isVideo = !!attachmentUrl && (
      contentType.startsWith('video/') ||
      ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(cleanExt)
    )
    const isAudioFile = !!attachmentUrl && (
      contentType.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga'].includes(cleanExt)
    )

    if (audioUrl || isAudioFile) {
      const src = audioUrl || attachmentUrl
      if (!src) return { node: null, kind: 'none' }
      return {
        kind: 'audio',
        node: (
          <VoiceMessage
            src={src}
            durationSeconds={durationSeconds}
          />
        ),
      }
    }

    if (isImage) {
      if (imagePreference === 'manual') {
        return {
          kind: 'image',
          node: (
            <button
              type="button"
              className="attach"
              onClick={() => window.open(attachmentUrl, '_blank', 'noopener')}
            >
              {filename ? `Open ${filename}` : 'View image'}
            </button>
          ),
        }
      }
      return {
        kind: 'image',
        node: (
          <figure className="media-attachment image">
            <div className="media-frame">
              <img src={attachmentUrl} alt={filename || 'Image attachment'} loading="lazy" />
            </div>
            <div className="media-meta">
              <span>{filename || 'Image'}</span>
              <a href={attachmentUrl} download>
                Download
              </a>
            </div>
          </figure>
        ),
      }
    }

    if (isVideo) {
      if (videoPreference === 'manual') {
        return {
          kind: 'video',
          node: (
            <button
              type="button"
              className="attach"
              onClick={() => window.open(attachmentUrl, '_blank', 'noopener')}
            >
              {filename ? `Open ${filename}` : 'Play video'}
            </button>
          ),
        }
      }
      return {
        kind: 'video',
        node: (
          <figure className="media-attachment video">
            <div className="media-frame">
              <video controls playsInline preload="metadata" src={attachmentUrl} />
            </div>
            <div className="media-meta">
              <span>{filename || 'Video'}</span>
              <a href={attachmentUrl} download>
                Download
              </a>
            </div>
          </figure>
        ),
      }
    }

    if (attachmentUrl) {
      return {
        kind: 'file',
        node: (
          <a className="attach" href={attachmentUrl} target="_blank" rel="noreferrer">
            {filename || 'Attachment'}
          </a>
        ),
      }
    }

    return { node: null, kind: 'none' }
  }, [imagePreference, videoPreference])

  const openMenu = React.useCallback((message: any, event: React.MouseEvent) => {
    event.stopPropagation()
    setMenuState({ open: true, x: event.clientX, y: event.clientY, message })
  }, [])

  const closeMenu = React.useCallback(() => {
    setMenuState(prev => ({ ...prev, open: false, message: null }))
  }, [])

  const sourceStreamRef = React.useRef<MediaStream | null>(null)

  const scrollToMessage = React.useCallback((target: string | number | null | undefined) => {
    if (target === undefined || target === null) return
    const container = listRef.current
    if (!container) return
    const raw = String(target)
    const escapeFn = (window as any).CSS?.escape as ((value: string) => string) | undefined
    const safe = escapeFn ? escapeFn(raw) : raw.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
    const el = container.querySelector<HTMLElement>(`[data-message-id="${safe}"]`)
    if (!el) return
    const containerRect = container.getBoundingClientRect()
    const targetRect = el.getBoundingClientRect()
    const offset = targetRect.top - containerRect.top + container.scrollTop - 80
    container.scrollTo({ top: offset, behavior: 'smooth' })
    el.classList.add('jump-highlight')
    window.setTimeout(() => {
      el.classList.remove('jump-highlight')
    }, 1400)
  }, [])

  // Socket & incoming events
  const handleIncoming = React.useCallback((data: any) => {
    switch (data.type) {
      case 'history': {
        setMessages(prev => {
          if (historyLoaded || prev.length) return prev
          const list = (data.messages || [])
            .map((item: any) => normalizeMsg(item))
            .filter(Boolean)
          return list as any[]
        })
        setHistoryLoaded(true)
        return
      }
      case 'typing':
        setTypingUser(data.typing ? data.from_user : null)
        return
      case 'reaction': {
        const { message_id, emoji, user_id, op } = data
        const uid = String(user_id)
        setMessages(prev => prev.map((m: any) => {
          if ((m.id ?? m._client_id) !== message_id) return m
          const next: Record<string, string[]> = {}
          let removedTarget = false
          Object.entries(m.reactions || {}).forEach(([key, list]) => {
            const filtered = (list || []).filter(id => id !== uid)
            if (filtered.length) {
              next[key] = filtered
            }
            if (key === emoji && filtered.length !== (list || []).length) {
              removedTarget = true
            }
          })

          const shouldAdd = op !== 'remove' && !removedTarget
          if (shouldAdd) {
            const set = new Set<string>(next[emoji] || [])
            set.add(uid)
            next[emoji] = Array.from(set)
          }
          return { ...m, reactions: next }
        }))
        return
      }
      case 'message_update':
      case 'message_meta': {
        const payload = normalizeMsg(data.payload)
        if (!payload) return
        mergeMessage(payload)
        return
      }
      case 'message_remove': {
        const id = data.message_id
        if (id) removeMessagesLocal([id])
        return
      }
      case 'message_remove_bulk': {
        const ids = (data.message_ids || []).filter(Boolean)
        if (ids.length) removeMessagesLocal(ids)
        return
      }
      default: {
        const payload = normalizeMsg(data)
        if (!payload) return
        const changed = mergeMessage(payload)
        if (changed && payload.sender_id && payload.sender_id !== (user?.id as any)) {
          playReceive()
        }
        return
      }
    }
  }, [historyLoaded, mergeMessage, normalizeMsg, playReceive, removeMessagesLocal, user?.id])

  const { sendMessage, sendTyping } = useChatSocket(roomId || '', token || '', handleIncoming)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  // send text
  const mkClientId = () => `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const onSend = () => {
    const text = draft.trim()
    if (!text && !composerContext) return
    const _client_id = mkClientId()
    const optimistic: any = {
      id: _client_id,
      _client_id,
      sender_id: user?.id,
      sender_name: (user as any)?.name || (user as any)?.username || 'Me',
      text,
      created_at: new Date().toISOString(),
      is_me: true,
      reactions: {},
      pinned: false,
      starred: false,
      note: '',
    }
    if (composerContext?.type === 'reply') {
      optimistic.reply_to = composerContext.message
    }
    if (composerContext?.type === 'forward') {
      optimistic.forwarded_from = composerContext.message
    }
    if (text) {
      setMessages(prev => [...prev, optimistic])
    }

    const payload: any = { content: text, _client_id }
    if (composerContext?.type === 'reply' && composerContext.message?.id) {
      payload.reply_to_id = composerContext.message.id
    }
    if (composerContext?.type === 'forward' && composerContext.message?.id) {
      payload.forwarded_from_id = composerContext.message.id
    }

    sendMessage(payload)
    playSend()
    setDraft('')
    setComposerContext(null)
  }

  // reactions (optimistic update + WS notify)
  const toggleReaction = (messageId: string | number, emoji: string) => {
    const uid = String(user?.id ?? 'me')
    const target = messages.find((m: any) => (m.id ?? m._client_id) === messageId)
    const previousEntry = Object.entries(target?.reactions || {}).find(([, list]) => Array.isArray(list) && list.includes(uid))
    const previousEmoji = previousEntry ? previousEntry[0] : null
    const sameEmoji = previousEmoji === emoji

    setMessages(prev => prev.map((m:any) => {
      if ((m.id ?? m._client_id) !== messageId) return m
      const next: Record<string, string[]> = {}
      Object.entries(m.reactions || {}).forEach(([key, list]) => {
        const filtered = (list || []).filter(id => id !== uid)
        if (filtered.length) next[key] = filtered
      })
      if (!sameEmoji) {
        const set = new Set<string>(next[emoji] || [])
        set.add(uid)
        next[emoji] = Array.from(set)
      }
      return { ...m, reactions: next }
    }))

    try {
      if (sameEmoji) {
        sendMessage({ type: 'reaction', message_id: messageId, emoji })
      } else {
        if (previousEmoji) sendMessage({ type: 'reaction', message_id: messageId, emoji: previousEmoji })
        sendMessage({ type: 'reaction', message_id: messageId, emoji })
      }
    } catch {}
  }

  // uploads
  const postFD = async (fd: FormData) => {
    if (!token || !roomId) return
    const audio = fd.get('audio')
    if (audio instanceof File && audio.size > MAX_UPLOAD_BYTES) {
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
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      if (r.ok) {
        const m = normalizeMsg(await r.json())
        if (m) mergeMessage(m)
      } else {
        let message = 'Upload failed.'
        try {
          const err = await r.json()
          message = err?.audio || err?.attachment || err?.detail || message
        } catch {}
        alert(message)
      }
    } finally { setUploading(false) }
  }
  const onDocPicked = async (e: any) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('attachment', f); await postFD(fd); e.target.value = '' }
  const onMediaPicked = async (e: any) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('attachment', f); await postFD(fd); e.target.value = '' }
  const onGifPicked = async (e: any) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type && !f.type.toLowerCase().includes('gif')) {
      alert('Please select a GIF file')
      e.target.value = ''
      return
    }
    const fd = new FormData(); fd.append('attachment', f); await postFD(fd); e.target.value = ''
  }
  const onAudioPicked = async (e: any) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      alert('Audio is larger than 3 MB. Please choose a smaller file.')
      e.target.value = ''
      return
    }
    const fd = new FormData(); fd.append('audio', f); await postFD(fd); e.target.value = ''
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
          await postFD(fd); return
        }
      } catch {}
    }
    vcardRef.current?.click()
  }

  const stopRecordAnimation = React.useCallback(() => {
    if (recordAnimationRef.current) {
      cancelAnimationFrame(recordAnimationRef.current)
      recordAnimationRef.current = null
    }
  }, [])

  const drawRecordWave = React.useCallback(() => {
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    if (!analyser || !dataArray) return
    analyser.getByteTimeDomainData(dataArray)
    const sliceCount = 24
    const step = Math.floor(dataArray.length / sliceCount) || 1
    const next: number[] = new Array(sliceCount).fill(0)
    for (let i = 0; i < sliceCount; i += 1) {
      let sum = 0
      for (let j = 0; j < step; j += 1) {
        const idx = i * step + j
        if (idx >= dataArray.length) break
        const value = (dataArray[idx] - 128) / 128
        sum += Math.abs(value)
      }
      next[i] = Math.min(sum / step * 3, 1.25)
    }
    setRecordPeaks(next)
    recordAnimationRef.current = requestAnimationFrame(drawRecordWave)
  }, [])

  // recorder
  const startRecording = async () => {
    if (isRecording) return
    if (typeof MediaRecorder === 'undefined') {
      alert('Audio recording is not supported in this browser.')
      return
    }
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const gain = audioCtx.createGain()
      gain.gain.value = 1.6
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      const destination = audioCtx.createMediaStreamDestination()
      source.connect(gain)
      gain.connect(analyser)
      gain.connect(destination)

      analyserRef.current = analyser
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      sourceStreamRef.current = stream

      const preferred = (() => {
        try {
          if (typeof MediaRecorder.isTypeSupported === 'function') {
            const found = AUDIO_MIME_CANDIDATES.find(candidate => MediaRecorder.isTypeSupported(candidate.mime))
            if (found) return found
          }
        } catch {}
        return AUDIO_MIME_CANDIDATES[1]
      })()

      let mr: MediaRecorder
      try {
        mr = new MediaRecorder(destination.stream, {
          mimeType: preferred.mime,
          audioBitsPerSecond: 128000,
        })
        recorderConfigRef.current = preferred
      } catch (error) {
        mr = new MediaRecorder(destination.stream)
        const actualMime = mr.mimeType || preferred.mime
        const mapped = AUDIO_MIME_CANDIDATES.find(candidate => candidate.mime === actualMime)
        recorderConfigRef.current = mapped || { mime: actualMime, ext: preferred.ext }
      }
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stopRecordAnimation()
        setRecordPeaks([])
        const config = recorderConfigRef.current || AUDIO_MIME_CANDIDATES[1]
        const blob = new Blob(audioChunksRef.current, { type: config.mime })
        if (blob.size > MAX_UPLOAD_BYTES) {
          alert('Audio is larger than 3 MB. Please record a shorter clip.')
        } else {
          const fd = new FormData()
          const ext = config.ext || 'webm'
          fd.append('audio', blob, `voice-${Date.now()}.${ext}`)
          await postFD(fd)
        }
        recorderConfigRef.current = null
        audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        sourceStreamRef.current?.getTracks().forEach(track => track.stop())
        sourceStreamRef.current = null
      }
      mediaRecorderRef.current = mr
      setRecordPeaks(new Array(24).fill(0.1))
      setIsRecording(true)
      mr.start()
      drawRecordWave()
    } catch {
      setIsRecording(false)
      stopRecordAnimation()
      setRecordPeaks([])
      recorderConfigRef.current = null
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
      sourceStreamRef.current?.getTracks().forEach(track => track.stop())
      sourceStreamRef.current = null
    }
  }
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
    stopRecordAnimation()
    setRecordPeaks([])
  }

  React.useEffect(() => {
    return () => {
      stopRecordAnimation()
      try { mediaRecorderRef.current?.stop() } catch {}
      mediaRecorderRef.current = null
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
      sourceStreamRef.current?.getTracks().forEach(track => track.stop())
      sourceStreamRef.current = null
    }
  }, [stopRecordAnimation])

  // --- define menuActions AFTER isAdmin and handlers exist ---
  const menuActions = React.useMemo<MessageMenuAction[]>(() => {
    const message = menuState.message
    if (!menuState.open || !message) return []
    const mine = message.is_me || message.sender_id === user?.id
    const hasServerId = isServerId(message?.id ? String(message.id) : '')
    const actions: MessageMenuAction[] = []

    actions.push({ key: 'info', label: 'Info', onClick: () => handleInfo(message), disabled: !hasServerId })
    actions.push({ key: 'reply', label: 'Reply', onClick: () => handleReply(message) })
    actions.push({ key: 'forward', label: 'Forward', onClick: () => handleForward(message) })

    if (message.text) {
      actions.push({ key: 'copy', label: 'Copy text', onClick: () => handleCopy(message) })
    }

    actions.push({
      key: 'star',
      label: message.starred ? 'Unstar' : 'Star',
      onClick: () => handleStarToggle(message),
      separatorBefore: true,
      disabled: !hasServerId,
    })

    actions.push({
      key: 'note',
      label: message.note ? 'Edit note' : 'Add note',
      onClick: () => handleNoteEdit(message),
      disabled: !hasServerId,
    })

    if (mine || isAdmin) {
      actions.push({
        key: 'pin',
        label: message.pinned ? 'Unpin' : 'Pin',
        onClick: () => handlePinToggle(message),
        disabled: !hasServerId,
      })
    }

    actions.push({
      key: 'select',
      label: selectionMode ? 'Add to selection' : 'Select messages',
      onClick: () => enterSelection(message.id ?? message._client_id),
      separatorBefore: true,
    })

    actions.push({
      key: 'delete-me',
      label: 'Delete for me',
      onClick: () => handleDelete(message, 'me'),
      danger: true,
    })

    if (mine || isAdmin) {
      actions.push({
        key: 'delete-all',
        label: 'Delete for everyone',
        onClick: () => handleDelete(message, 'all'),
        danger: true,
        disabled: !hasServerId,
      })
    }

    return actions
  }, [
    enterSelection,
    handleDelete,
    handleForward,
    handleInfo,
    handleNoteEdit,
    handlePinToggle,
    handleStarToggle,
    handleCopy,
    isAdmin,
    isServerId,
    menuState.message,
    menuState.open,
    selectionMode,
    user?.id,
  ])

  // ---- Render list with grouping + day separators ----
  type RenderItem =
    | { kind: 'day'; id: string; label: string }
    | { kind: 'msg'; id: string; mine: boolean; showAvatar: boolean; showTail: boolean; selected: boolean; m: any }

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
    const messageKey = String(m.id ?? m._client_id ?? `k-${m.created_at}-${i}`)
    const selected = selectedSet.has(messageKey)
    renderItems.push({
      kind: 'msg',
      id: messageKey,
      mine: !!m.is_me || m.sender_id === user?.id,
      showAvatar,
      showTail,
      selected,
      m,
    })
  })

  if (!token) return null

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

      {selectionMode && (
        <div className="selection-bar">
          <span>{selectedIds.length} selected</span>
          <div className="actions">
            <button type="button" onClick={() => handleBulkDelete('me')}>Delete</button>
            {(isAdmin || selectedIds.every(id => {
              const msg = messages.find((m: any) => m.id === id || m._client_id === id)
              return msg?.is_me || msg?.sender_id === user?.id
            })) && (
              <button type="button" onClick={() => handleBulkDelete('all')}>Delete for all</button>
            )}
            <button type="button" onClick={clearSelection}>Cancel</button>
          </div>
        </div>
      )}

      <div className="chat-scroll" ref={listRef}>
        {renderItems.map((it, idx) => {
          if (it.kind === 'day') return <div key={it.id} className="day-sep"><span>{it.label}</span></div>
          const { m, mine, showAvatar, showTail, selected } = it
          const key = it.id || idx
          const messageId = it.id
          const reactionPairs = Object.entries(m.reactions || {}).filter(([, arr]) => Array.isArray(arr) && arr.length>0)
          const attachment = renderAttachment(m)
          const hasAttachment = attachment.kind !== 'none'
          const hasText = !!m.text
          const voiceOnly = attachment.kind === 'audio' && !hasText
          const attachmentOnly = !hasText && hasAttachment

          const handleContextMenu = (e: React.MouseEvent) => {
            e.preventDefault()
            openMenu(m, e)
          }

          const bubbleClass = [
            'bubble',
            mine ? 'me' : 'other',
            showTail ? 'tail' : '',
            selected ? 'selected' : '',
            voiceOnly ? 'voice-only' : '',
            attachmentOnly ? 'attachment-only' : '',
          ].filter(Boolean).join(' ')

          const replyTargetId = m.reply_to?.id ?? m.reply_to?._client_id ?? null

          return (
            <div key={key} className={`row ${mine ? 'right' : 'left'}`} onContextMenu={handleContextMenu}>
              {!mine && showAvatar && (
                <div className="avatar-badge sm">{(m.sender_name || 'U').slice(0,1).toUpperCase()}</div>
              )}

              {selectionMode && (
                <input
                  type="checkbox"
                  className="select-checkbox"
                  checked={selected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelection(messageId)}
                />
              )}

              <div
                className={bubbleClass}
                data-message-id={messageId}
                onClick={() => { if (selectionMode) toggleSelection(messageId) }}
              >
                <button
                  className="more"
                  aria-label="Message actions"
                  onClick={(e) => openMenu(m, e)}
                >
                  ⋯
                </button>

                {m.pinned && (<div className="pin-flag">📌 Pinned</div>)}
                {m.starred && <div className="meta-row"><span className="star">★</span> Starred</div>}
                {m.note && <div className="note-chip">Note: {m.note}</div>}

                {m.reply_to && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="reply-preview actionable"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!selectionMode) scrollToMessage(replyTargetId)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!selectionMode) scrollToMessage(replyTargetId)
                      }
                    }}
                  >
                    <strong>{m.reply_to.sender_name}</strong>
                    <div>{m.reply_to.text || (m.reply_to.attachment ? 'Attachment' : '')}</div>
                  </div>
                )}

                {m.forwarded_from && (
                  <div className="reply-preview">
                    <strong>Forwarded from {m.forwarded_from.sender_name}</strong>
                    <div>{m.forwarded_from.text || (m.forwarded_from.attachment ? 'Attachment' : '')}</div>
                  </div>
                )}

                {m.text && <p>{m.text}</p>}
                {attachment.node}

                <span className="time">
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>

                {reactionPairs.length > 0 && (
                  <div className="rxn-chips">
                    {reactionPairs.map(([emoji, arr]: any) => (
                      <span key={`${emoji}`} className="rxn-chip">{emoji} {arr.length}</span>
                    ))}
                  </div>
                )}

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
              <button className="attach-item" onClick={() => gifRef.current?.click()}>🎞️ GIF</button>
              <button className="attach-item" onClick={() => audioRef.current?.click()}>🎧 Audio</button>
              <button className="attach-item" onClick={pickContact}>👤 Contact</button>
            </div>
          )}
          {isRecording && (
            <div className="record-visual" aria-label="Recording audio">
              {(recordPeaks.length ? recordPeaks : new Array(24).fill(0.1)).map((v, i) => (
                <span
                  key={i}
                  className="bar"
                  style={{ transform: `scaleY(${Math.max(v, 0.08) + 0.2})` }}
                />
              ))}
            </div>
          )}
          <input ref={docRef} type="file" onChange={onDocPicked} hidden />
          <input ref={mediaRef} type="file" accept="image/*,video/*" onChange={onMediaPicked} hidden />
          <input ref={gifRef} type="file" accept="image/gif" onChange={onGifPicked} hidden />
          <input ref={audioRef} type="file" accept="audio/*" onChange={onAudioPicked} hidden />
          <input ref={vcardRef} type="file" accept=".vcf,text/vcard" hidden />
        </div>

        {composerContext && (
          <div className="composer-context">
            <div className="context-body">
              <strong>{composerContext.type === 'reply' ? 'Replying to' : 'Forwarding'}</strong> {composerContext.message?.sender_name || 'message'}
            </div>
            <button type="button" onClick={() => setComposerContext(null)}>✕</button>
          </div>
        )}

        <input
          value={draft}
          onChange={e => { setDraft(e.target.value); try { sendTyping?.(true) } catch {} }}
          onBlur={() => { try { sendTyping?.(false) } catch {} }}
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
            {isAdmin && <button className="btn small" onClick={() => navigate(`/chat/${roomId}/invite`)}>+ Invite</button>}
          </div>
        </aside>
      )}

      <MessageMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        actions={menuActions}
        onClose={closeMenu}
      />

      <MessageInfoModal
        open={infoState.open}
        loading={infoState.loading}
        data={infoState.data}
        onClose={() => setInfoState({ open: false, loading: false })}
      />

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
