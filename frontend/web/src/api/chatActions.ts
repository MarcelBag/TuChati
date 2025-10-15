import { apiFetch } from '../shared/api'

export type DeleteScope = 'me' | 'all'

export async function deleteMessage(roomId: string, messageId: string, scope: DeleteScope = 'me') {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/${messageId}/delete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to delete message')
  }
}

export async function deleteMessages(roomId: string, messageIds: string[], scope: DeleteScope = 'me') {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/bulk-delete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: messageIds, scope }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to delete messages')
  }
  return res.json().catch(() => ({ deleted: [] }))
}

export async function setPinned(roomId: string, messageId: string, pinned: boolean) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/${messageId}/pin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to update pin state')
  }
  return res.json()
}

export async function setStarred(roomId: string, messageId: string, starred: boolean) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/${messageId}/star/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starred }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to update star state')
  }
  return res.json()
}

export async function saveNote(roomId: string, messageId: string, note: string) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/${messageId}/note/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to save note')
  }
  return res.json()
}

export async function fetchMessageInfo(roomId: string, messageId: string) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/${messageId}/info/`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to load message info')
  }
  return res.json()
}
