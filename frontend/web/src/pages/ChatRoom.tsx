// frontend/web/src/pages/ChatRoom.tsx
// ============================================================
// TuChati Chat Room grouping + day separators + reactions
// Per-bubble "more" chevron to open actions menu
// Emoji reactions; listens for WS 'reaction' events
// (Fixed TDZ/ReferenceError: menuActions; boolean op; ordering)
// ============================================================
import React from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { apiFetch, resolveUrl } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { ChatRoom as Room } from '../types'
import type { ChatOutletContext } from './ChatPage'
import './ChatRoom.css'
import ReactionsBar, { REACTION_SET } from '../components/Chat/ReactionsBar'
import MessageMenu, { MessageMenuAction } from '../components/Chat/MessageMenu'
import VoiceMessage from '../components/Chat/VoiceMessage'
import MessageInfoModal from '../components/Chat/MessageInfoModal'
import ForwardMessageModal from '../components/Chat/ForwardMessageModal'
import InviteUsersModal from '../components/Chat/InviteUsersModal'
import ImagePreviewModal from '../shared/ImagePreviewModal'
import AvatarBubble from '../shared/AvatarBubble'
import { useChatNotifications } from '../hooks/useChatNotifications'
import { useMediaPreference, usePreferences } from '../context/PreferencesContext'
import { deleteMessage, deleteMessages, fetchMessageInfo, fetchUserProfile, forwardMessage, inviteUsers, listRooms, saveNote, searchUsers, setPinned, setStarred } from '../api/chatActions'

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

function describeLastSeen(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000)
  if (minutes < 1) return 'Last seen just now'
  if (minutes < 60) return `Last seen ${minutes} min${minutes !== 1 ? 's' : ''} ago`

  const sameDay = now.toDateString() === date.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (sameDay) return `Last seen today at ${time}`
  if (yesterday.toDateString() === date.toDateString()) return `Last seen yesterday at ${time}`

  const day = date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
  return `Last seen ${day} ${time}`
}

function formatStatus(status?: string | null) {
  if (!status) return ''
  const map: Record<string, string> = {
    online: 'Online',
    away: 'Away',
    offline: 'Offline',
    dnd: 'Do Not Disturb',
  }
  return map[status] || status.charAt(0).toUpperCase() + status.slice(1)
}

function describeField(value?: string | null, allowed?: boolean, empty = 'Not shared') {
  if (value && value.trim().length > 0) return value
  if (allowed === false) return 'Hidden by privacy'
  return empty
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
  const outletContext = useOutletContext<ChatOutletContext | null>()
  const updateRoomUnread = outletContext?.updateRoomUnread
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
  const [forwardOpen, setForwardOpen] = React.useState(false)
  const [forwardMessageTarget, setForwardMessageTarget] = React.useState<any | null>(null)
  const [forwardRooms, setForwardRooms] = React.useState<any[]>([])
  const [forwardSelected, setForwardSelected] = React.useState<string[]>([])
  const [forwardLoading, setForwardLoading] = React.useState(false)
  const [forwardSubmitting, setForwardSubmitting] = React.useState(false)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteLoading, setInviteLoading] = React.useState(false)
  const [inviteSubmitting, setInviteSubmitting] = React.useState(false)
  const [inviteUsersOptions, setInviteUsersOptions] = React.useState<any[]>([])
  const [inviteSelected, setInviteSelected] = React.useState<string[]>([])
  const [directProfile, setDirectProfile] = React.useState<{ open: boolean; loading: boolean; data: any | null; error: string | null }>({ open: false, loading: false, data: null, error: null })
  const [photoPreview, setPhotoPreview] = React.useState<{ open: boolean; src: string | null; alt: string }>({ open: false, src: null, alt: 'Profile photo' })
  const listRef = React.useRef<HTMLDivElement>(null)
  const deliveredAckRef = React.useRef<Set<string>>(new Set())
  const readAckRef = React.useRef<Set<string>>(new Set())

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])

  const directPartner = React.useMemo(() => {
    if (!room || room?.is_group) return null
    const meId = String(user?.id ?? '')
    const members = (room?.members || (room as any)?.participants || []) as any[]
    for (const entry of members) {
      if (!entry) continue
      const value = entry.id ?? entry.user_id ?? entry
      if (value === undefined || value === null) continue
      if (String(value) === meId) continue
      const identifier = entry.uuid ?? entry.id ?? entry.user_id ?? entry.username
      return {
        identifier: identifier ? String(identifier) : String(entry.username || ''),
        id: entry.id ?? entry.user_id ?? null,
        username: entry.username ?? entry.name ?? '',
        name: entry.name ?? entry.username ?? entry.email ?? 'User',
        raw: entry,
      }
    }
    return null
  }, [room, user?.id])

  const memberInfoMap = React.useMemo(() => {
    const map = new Map<string, any>()
    const members = (room?.members || (room as any)?.participants || []) as any[]
    members.forEach((entry) => {
      if (!entry) return
      const value = entry.id ?? entry.user_id ?? entry
      if (value === undefined || value === null) return
      map.set(String(value), entry)
    })
    return map
  }, [room])

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
  const profileCacheRef = React.useRef<Record<string, any>>({})
  const imagePreference = useMediaPreference('images')
  const videoPreference = useMediaPreference('videos')
  const { prefs } = usePreferences()

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

  React.useEffect(() => {
    setDirectProfile({ open: false, loading: false, data: null, error: null })
    setPhotoPreview({ open: false, src: null, alt: 'Profile photo' })
  }, [roomId, isGroup])

  React.useEffect(() => { setHistoryLoaded(false); setMessages([]) }, [roomId])

  React.useEffect(() => {
    deliveredAckRef.current.clear()
    readAckRef.current.clear()
  }, [roomId])

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

  const loadDirectProfile = React.useCallback(() => {
    if (!directPartner?.identifier) return
    const partnerSnapshot = directPartner
    const key = partnerSnapshot.identifier
    const cached = profileCacheRef.current[key]
    setDirectProfile({ open: true, loading: !cached, data: cached ?? null, error: null })
    ;(async () => {
      try {
        const data = await fetchUserProfile(key)
        profileCacheRef.current[key] = data
        if (directPartner?.identifier !== partnerSnapshot.identifier) return
        setDirectProfile({ open: true, loading: false, data, error: null })
      } catch (error: any) {
        if (directPartner?.identifier !== partnerSnapshot.identifier) return
        setDirectProfile(prev => ({
          open: true,
          loading: false,
          data: prev.data ?? cached ?? null,
          error: error?.message || 'Failed to load profile',
        }))
      }
    })()
  }, [directPartner])

  const handleHeaderClick = React.useCallback(() => {
    if (isGroup) {
      setShowInfo((prev) => !prev)
      return
    }
    if (!directPartner) return
    if (directProfile.open) {
      setDirectProfile(prev => ({ ...prev, open: false }))
      return
    }
    loadDirectProfile()
  }, [directPartner, directProfile.open, isGroup, loadDirectProfile])

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

    const deliveredTo = Array.isArray(raw.delivered_to) ? raw.delivered_to.map((v: any) => String(v)) : []
    const readBy = Array.isArray(raw.read_by) ? raw.read_by.map((v: any) => String(v)) : []

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
      delivered_to: deliveredTo,
      delivered_at: raw.delivered_at ?? null,
      read_by: readBy,
      read_at: raw.read_at ?? null,
    } as any
  }, [user?.id])

  const myId = React.useMemo(() => String(user?.id ?? ''), [user?.id])

  React.useEffect(() => {
    if (!updateRoomUnread || !roomId) return
    updateRoomUnread(roomId, 0)
  }, [roomId, updateRoomUnread])

  React.useEffect(() => {
    if (!updateRoomUnread || !roomId) return
    updateRoomUnread(roomId, 0)
  }, [messages, roomId, updateRoomUnread])
  const memberIdSet = React.useMemo(() => {
    const source = (room?.members || (room as any)?.participants || []) as any[]
    const set = new Set<string>()
    source.forEach((entry) => {
      if (!entry) return
      const value = entry.id ?? entry.user_id ?? entry
      if (value !== undefined && value !== null) set.add(String(value))
    })
    return set
  }, [room])

  const existingUsernames = React.useMemo(() => {
    const members = (room?.members || (room as any)?.participants || []) as any[]
    const set = new Set<string>()
    members.forEach((entry) => {
      const username = entry?.username
      if (username) set.add(String(username))
    })
    return set
  }, [room])

  const computeStatus = React.useCallback((message: any): 'sent' | 'delivered' | 'read' | null => {
    if (!message || !message.is_me) return null
    const others = Array.from(memberIdSet).filter(id => id && id !== myId)
    if (!others.length) return 'sent'
    const read = (message.read_by || []).filter((id: string) => id !== myId)
    if (read.length >= others.length) return 'read'
    const delivered = (message.delivered_to || []).filter((id: string) => id !== myId)
    if (delivered.length >= others.length) return 'delivered'
    return 'sent'
  }, [memberIdSet, myId])

  // --- mergeMessage must come BEFORE any callbacks that depend on it ---
  const mergeMessage = React.useCallback((payload: any) => {
    if (!payload) return false
    const normalized = { ...payload }
    if (!!normalized.sender_id && normalized.sender_id === (user?.id as any)) {
      normalized.is_me = true
    }
    normalized.status = computeStatus(normalized)

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
        updated.status = computeStatus(updated)
        if (!isGroup && updated.sender_id !== user?.id && Array.isArray(updated.read_by)) {
          const filtered = updated.read_by.filter((id: string) => String(id) !== myId)
          if (filtered.length !== updated.read_by.length) {
            updated.read_by = filtered
          }
        }
        if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          changed = true
        }
        const next = prev.slice()
        next[idx] = updated
        return next
      }

      changed = true
      const nextItem: any = { ...normalized, status: computeStatus(normalized) }
      if (!isGroup && nextItem.sender_id !== user?.id && Array.isArray(nextItem.read_by)) {
        nextItem.read_by = nextItem.read_by.filter((id: string) => String(id) !== myId)
      }
      return [...prev, nextItem]
    })
    return changed
  }, [computeStatus, removeMessagesLocal, user?.id])

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
    setForwardMessageTarget(message)
    setForwardSelected([])
    setForwardOpen(true)
  }, [])

  const closeForwardModal = React.useCallback(() => {
    setForwardOpen(false)
    setForwardMessageTarget(null)
    setForwardSelected([])
    setForwardLoading(false)
    setForwardSubmitting(false)
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
          Object.entries(m.reactions || {}).forEach(([key, list]) => {
            const set = new Set<string>(list || [])
            if (set.has(uid)) set.delete(uid)
            if (set.size) next[key] = Array.from(set)
          })

          const shouldAdd = op !== 'remove'
          if (shouldAdd) {
            const set = new Set<string>(next[emoji] || [])
            set.add(uid)
            next[emoji] = Array.from(set)
          }
          const updated = { ...m, reactions: next }
          if (updated.is_me) {
            updated.status = computeStatus(updated)
          }
          return updated
        }))
        return
      }
      case 'delivery': {
        const { status: deliveryStatus, ids, user_id } = data
        const actorId = user_id ? String(user_id) : null
        if (!Array.isArray(ids) || ids.length === 0 || !actorId) return
        setMessages(prev => prev.map((m: any) => {
          const messageId = m.id ?? m._client_id
          if (!ids.includes(messageId)) return m
          const next = { ...m }
          const deliveredSet = new Set<string>(Array.isArray(next.delivered_to) ? next.delivered_to : [])
          const readSet = new Set<string>(Array.isArray(next.read_by) ? next.read_by : [])
          if (deliveryStatus === 'delivered' || deliveryStatus === 'read') {
            deliveredSet.add(actorId)
            next.delivered_to = Array.from(deliveredSet)
            if (deliveryStatus === 'read') {
              readSet.add(actorId)
              next.read_by = Array.from(readSet)
            }
          }
          next.status = computeStatus(next)
          return next
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
  }, [computeStatus, historyLoaded, mergeMessage, normalizeMsg, playReceive, removeMessagesLocal, user?.id])

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
        const set = new Set<string>(list || [])
        if (set.has(uid)) set.delete(uid)
        if (set.size) next[key] = Array.from(set)
      })
      if (!sameEmoji) {
        const set = new Set<string>(next[emoji] || [])
        set.add(uid)
        next[emoji] = Array.from(set)
      }
      const updated = { ...m, reactions: next }
      if (updated.is_me) updated.status = computeStatus(updated)
      return updated
    }))

    try {
      if (sameEmoji) {
        sendMessage({ type: 'reaction', message_id: messageId, emoji, op: 'remove' })
      } else {
        if (previousEmoji) sendMessage({ type: 'reaction', message_id: messageId, emoji: previousEmoji, op: 'remove' })
        sendMessage({ type: 'reaction', message_id: messageId, emoji, op: 'add' })
      }
    } catch {}
  }

  React.useEffect(() => {
    if (!prefs.shareDeliveryReceipts && !prefs.shareReadReceipts) return
    const deliverIds: string[] = []
    const readIds: string[] = []
    messages.forEach((m: any) => {
      const serverId = isServerId(m?.id ? String(m.id) : '') ? String(m.id) : null
      if (!serverId || m.is_me) return
      if (prefs.shareDeliveryReceipts && !deliveredAckRef.current.has(serverId)) {
        const delivered = Array.isArray(m.delivered_to) ? m.delivered_to : []
        if (!delivered.includes(myId)) {
          deliverIds.push(serverId)
        } else {
          deliveredAckRef.current.add(serverId)
        }
      }
      if (prefs.shareReadReceipts && !readAckRef.current.has(serverId)) {
        const read = Array.isArray(m.read_by) ? m.read_by : []
        if (!read.includes(myId)) {
          readIds.push(serverId)
        } else {
          readAckRef.current.add(serverId)
        }
      }
    })

    if (deliverIds.length) {
      try {
        sendMessage({ type: 'delivered', ids: deliverIds })
        deliverIds.forEach(id => deliveredAckRef.current.add(id))
      } catch {}
    }
    if (readIds.length) {
      try {
        sendMessage({ type: 'read', ids: readIds })
        readIds.forEach(id => readAckRef.current.add(id))
      } catch {}
    }
  }, [isServerId, messages, myId, prefs.shareDeliveryReceipts, prefs.shareReadReceipts, sendMessage])

  React.useEffect(() => {
    if (!forwardOpen) return
    let cancelled = false
    setForwardLoading(true)
    listRooms()
      .then((rooms) => {
        if (cancelled) return
        const normalized = Array.isArray(rooms) ? rooms : []
        setForwardRooms(
          normalized.map((room: any) => ({
            id: String(room.id ?? room.uuid ?? ''),
            name: room.name || room.title || 'Room',
            is_group: room.is_group,
          })).filter((room) => room.id),
        )
      })
      .catch(() => {
        if (cancelled) return
        setForwardRooms([])
      })
      .finally(() => {
        if (!cancelled) setForwardLoading(false)
      })
    return () => { cancelled = true }
  }, [forwardOpen])

  const toggleForwardSelection = React.useCallback((id: string) => {
    setForwardSelected(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }, [])

  const openInviteModal = React.useCallback(() => {
    window.setTimeout(() => {
      setInviteOpen(true)
      setInviteSelected([])
      setInviteUsersOptions([])
      setInviteLoading(false)
      setInviteSubmitting(false)
    }, 0)
  }, [])

  const closeInviteModal = React.useCallback(() => {
    setInviteOpen(false)
    setInviteSelected([])
    setInviteUsersOptions([])
    setInviteLoading(false)
    setInviteSubmitting(false)
  }, [])

  const handleInviteSearch = React.useCallback((query: string) => {
    if (!inviteOpen) return
    if (!query) {
      setInviteUsersOptions([])
      return
    }
    setInviteLoading(true)
    searchUsers(query)
      .then((results) => {
        const rows = Array.isArray(results) ? results : []
        setInviteUsersOptions(rows.map((item: any) => ({
          id: String(item.id ?? item.username ?? Math.random()),
          username: item.username,
          email: item.email,
          name: item.name,
        })).filter((user) => user.username))
      })
      .catch(() => {
        setInviteUsersOptions([])
      })
      .finally(() => setInviteLoading(false))
  }, [existingUsernames, inviteOpen])

  const toggleInviteSelection = React.useCallback((username: string) => {
    setInviteSelected(prev => (prev.includes(username) ? prev.filter(item => item !== username) : [...prev, username]))
  }, [])

  const submitInvite = React.useCallback(async () => {
    if (!roomId) return
    if (inviteSelected.length === 0) {
      alert('Select at least one user to invite.')
      return
    }
    setInviteSubmitting(true)
    try {
      await inviteUsers(roomId, inviteSelected, [])
      alert('Invitations sent.')
      closeInviteModal()
      try {
        const res = await apiFetch(`/api/chat/rooms/${roomId}/`)
        if (res.ok) {
          const data = await res.json()
          setRoom(data)
        }
      } catch {}
    } catch (error: any) {
      alert(error?.message || 'Unable to invite users')
    } finally {
      setInviteSubmitting(false)
    }
  }, [closeInviteModal, inviteSelected, roomId])

  const submitForward = React.useCallback(async () => {
    if (!forwardMessageTarget || !isServerId(forwardMessageTarget?.id ? String(forwardMessageTarget.id) : '')) {
      alert('Message is not ready to forward yet.')
      return
    }
    if (forwardSelected.length === 0) {
      alert('Select at least one room to forward to.')
      return
    }
    setForwardSubmitting(true)
    try {
      const results = await Promise.allSettled(
        forwardSelected.map((room) => forwardMessage(room, String(forwardMessageTarget.id))),
      )
      const successes: Array<{ roomId: string; payload: any }> = []
      const failures: Array<{ roomId: string; reason: any }> = []
      results.forEach((result, index) => {
        const destRoom = forwardSelected[index]
        if (result.status === 'fulfilled') successes.push({ roomId: destRoom, payload: result.value })
        else failures.push({ roomId: destRoom, reason: result.reason })
      })

      successes.forEach(({ roomId: targetRoomId, payload }) => {
        if (roomId && targetRoomId === roomId) {
          const normalized = normalizeMsg(payload)
          mergeMessage(normalized)
        }
      })

      if (failures.length === 0) {
        alert('Message forwarded successfully.')
        closeForwardModal()
      } else if (failures.length === results.length) {
        alert('Unable to forward the message. Please try again later.')
      } else {
        alert('Message forwarded to some rooms, but a few failed.')
        closeForwardModal()
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to forward message')
    } finally {
      setForwardSubmitting(false)
    }
  }, [closeForwardModal, forwardMessageTarget, forwardSelected, isServerId, mergeMessage, normalizeMsg, roomId])

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
    actions.push({ key: 'forward', label: 'Forward', onClick: () => handleForward(message), disabled: !hasServerId })

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

    if (room?.is_group && (mine || isAdmin)) {
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
    room?.is_group,
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

  const headerTitle = room?.name || directPartner?.name || 'Room'
  const headerInitial = (headerTitle || 'R').slice(0, 1).toUpperCase()
  const headerSubtitle = typingUser
    ? `${typingUser} is typing…`
    : (isGroup ? 'Group chat' : (directPartner?.username ? `@${directPartner.username}` : 'Direct chat'))

  const profileData = directProfile.data
  const partnerRaw = directPartner?.raw as any
  const profilePrivacy = profileData?.privacy ?? {}
  const headerInitials = partnerRaw?.initials || headerInitial
  const headerAvatar = !isGroup ? (profileData?.avatar || partnerRaw?.avatar || null) : null
  const profileAvatar = resolveUrl(profileData?.avatar || partnerRaw?.avatar || null)
  const profileInitials = profileData?.initials || partnerRaw?.initials || headerInitial
  const profileDisplayName = profileData?.display_name || directPartner?.name || headerTitle || 'User'
  const profileUsername = profileData?.username || directPartner?.username || ''
  const statusBadge = profileData ? (profileData.is_online ? 'Online now' : formatStatus(profileData.current_status)) : ''
  const lastSeenLine = profileData
    ? (profileData.is_online
        ? 'Active now'
        : profileData.last_seen
          ? describeLastSeen(profileData.last_seen)
          : profilePrivacy.share_last_seen === false
            ? 'Last seen hidden by privacy'
            : 'Last seen unavailable')
    : ''
  const statusMessageValue = profileData
    ? (profileData.status_message && profileData.status_message.trim()
        ? profileData.status_message.trim()
        : profilePrivacy.share_status_message === false
          ? 'Status hidden by privacy'
          : '')
    : ''
  const bioValue = profileData
    ? (profileData.bio && profileData.bio.trim()
        ? profileData.bio.trim()
        : profilePrivacy.share_bio === false
          ? 'Bio hidden by privacy'
          : '')
    : ''
  const emailValue = profileData ? describeField(profileData.email, profilePrivacy.share_contact_info, 'Not provided') : ''
  const phoneValue = profileData ? describeField(profileData.phone, profilePrivacy.share_contact_info, 'Not provided') : ''
  const privacySummary = `Avatar ${profilePrivacy.share_avatar === false ? 'hidden' : 'visible'} · Contact ${profilePrivacy.share_contact_info === false ? 'hidden' : 'visible'} · Status ${profilePrivacy.share_status_message === false ? 'hidden' : 'visible'} · Bio ${profilePrivacy.share_bio === false ? 'hidden' : 'visible'} · Last seen ${profilePrivacy.share_last_seen === false ? 'hidden' : 'visible'}`

  if (!token) return null

  return (
    <>
      <header className="chat-hd">
        <div className="title">
          <AvatarBubble
            src={headerAvatar}
            name={headerTitle}
            initials={headerInitials}
            size="lg"
            interactive={!isGroup && !!directPartner}
            onClick={!isGroup && directPartner ? (event) => { event.preventDefault(); event.stopPropagation(); handleHeaderClick() } : undefined}
            ariaLabel={isGroup ? `${headerTitle} room` : `${headerTitle} profile`}
          />
          <div>
            <div
              className="name"
              onClick={handleHeaderClick}
              style={{ cursor: (isGroup || directPartner) ? 'pointer' : undefined }}
            >
              {headerTitle}{' '}
              {(isGroup || directPartner) && (
                <span className="ri-tip">{isGroup ? '(tap for info)' : '(tap for profile)'}</span>
              )}
            </div>
            <div className="sub">{headerSubtitle}</div>
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
          const senderInfo = m.sender_id ? memberInfoMap.get(String(m.sender_id)) : null
          const senderInitials = senderInfo?.initials || (m.sender_name || 'U').slice(0, 2)
          const senderAvatar = senderInfo?.avatar || null
          const senderName = senderInfo?.name || m.sender_name || 'User'
          const reactionPairs = Object.entries(m.reactions || {}).filter(([, arr]) => Array.isArray(arr) && arr.length>0)
          const status = m.status || null
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
                <AvatarBubble
                  src={senderAvatar}
                  name={senderName}
                  initials={senderInitials}
                  size="sm"
                  ariaLabel={`${senderName} avatar`}
                />
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
                  {mine && status && (
                    <span className={`status-icon status-${status}`} aria-label={`Message ${status}`}>
                      {status === 'sent' ? '✓' : '✓✓'}
                    </span>
                  )}
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

      {!isGroup && (
        <aside className={`room-info ${directProfile.open ? 'open' : ''}`}>
          <div className="room-info-hd direct">
            <div
              className={`ri-profile-avatar ${profileAvatar ? 'has-image' : ''}`}
              role={profileAvatar ? 'button' : undefined}
              tabIndex={profileAvatar ? 0 : undefined}
              aria-label={profileAvatar ? 'View profile photo' : undefined}
              onClick={() => {
                if (!profileAvatar) return
                setPhotoPreview({ open: true, src: profileAvatar, alt: `${profileDisplayName} avatar` })
              }}
              onKeyDown={(event) => {
                if (!profileAvatar) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setPhotoPreview({ open: true, src: profileAvatar, alt: `${profileDisplayName} avatar` })
                }
              }}
            >
              {profileAvatar ? (
                <img src={profileAvatar} alt={`${profileDisplayName} avatar`} />
              ) : (
                <span>{profileInitials}</span>
              )}
            </div>
            <div className="ri-meta">
              <h4>{profileDisplayName}</h4>
              {profileUsername && <p className="ri-username">@{profileUsername}</p>}
              {(statusBadge || lastSeenLine) && (
                <div className="ri-status-block">
                  {statusBadge && (
                    <span className={`ri-status-badge ${profileData?.is_online ? 'online' : ''}`}>
                      {statusBadge}
                    </span>
                  )}
                  {lastSeenLine && !profileData?.is_online && (
                    <span className="ri-status-sub">{lastSeenLine}</span>
                  )}
                </div>
              )}
            </div>
            <button className="ri-close" onClick={() => setDirectProfile(prev => ({ ...prev, open: false }))}>✕</button>
          </div>

          <div className="ri-section">
            {directProfile.loading && !profileData && <p className="ri-loading">Loading profile…</p>}
            {directProfile.error && <p className="ri-error">{directProfile.error}</p>}

            {profileData && (
              <div className="ri-profile">
                {statusMessageValue && (
                  <p className={`ri-status-message ${statusMessageValue === 'Status hidden by privacy' ? 'muted' : ''}`}>
                    {statusMessageValue}
                  </p>
                )}

                {bioValue && (
                  <p className={`ri-bio ${bioValue === 'Bio hidden by privacy' ? 'muted' : ''}`}>
                    {bioValue}
                  </p>
                )}

                <div className="ri-profile-details">
                  <div className="ri-detail-row">
                    <span className="ri-detail-label">Email</span>
                    <span className={`ri-detail-value ${profileData?.email ? '' : 'muted'}`}>{emailValue}</span>
                  </div>
                  <div className="ri-detail-row">
                    <span className="ri-detail-label">Phone</span>
                    <span className={`ri-detail-value ${profileData?.phone ? '' : 'muted'}`}>{phoneValue}</span>
                  </div>
                  <div className="ri-detail-row">
                    <span className="ri-detail-label">Last seen</span>
                    <span className={`ri-detail-value ${(!profileData?.is_online && !profileData?.last_seen) ? 'muted' : ''}`}>
                      {profileData?.is_online ? 'Active now' : lastSeenLine}
                    </span>
                  </div>
                  <div className="ri-detail-row">
                    <span className="ri-detail-label">Privacy</span>
                    <span className="ri-detail-value muted">{privacySummary}</span>
                  </div>
                </div>
              </div>
            )}

            {!directProfile.loading && !directProfile.error && !profileData && (
              <p className="ri-empty">Profile details not available.</p>
            )}
          </div>
        </aside>
      )}

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
                  <span className={`ri-avatar ${m.avatar ? 'has-image' : ''}`}>
                    {m.avatar ? <img src={resolveUrl(m.avatar)} alt={`${m.name || m.username || 'User'} avatar`} /> : (m.initials || (m.name || m.username || 'U').slice(0, 1))}
                  </span>
                  <span className="ri-name">{m.name || m.username || m.email}</span>
                </li>
              ))}
            </ul>
            {isAdmin && (
              <button
                className="btn small"
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  console.debug('[UI] Invite modal open triggered')
                  openInviteModal()
                }}
              >
                + Invite
              </button>
            )}
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

      <ForwardMessageModal
        open={forwardOpen}
        loading={forwardLoading}
        submitting={forwardSubmitting}
        rooms={forwardRooms}
        selected={forwardSelected}
        message={forwardMessageTarget}
        onClose={closeForwardModal}
        onToggle={toggleForwardSelection}
        onSubmit={submitForward}
      />

      <InviteUsersModal
        open={inviteOpen}
        loading={inviteLoading}
        submitting={inviteSubmitting}
        users={inviteUsersOptions}
        selected={inviteSelected}
        onClose={closeInviteModal}
        onSearch={handleInviteSearch}
        onToggle={toggleInviteSelection}
        onSubmit={submitInvite}
      />

      <ImagePreviewModal
        open={photoPreview.open && !!photoPreview.src}
        src={photoPreview.src ?? undefined}
        alt={photoPreview.alt}
        onClose={() => setPhotoPreview({ open: false, src: null, alt: 'Profile photo' })}
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
