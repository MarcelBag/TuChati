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

export async function listRooms() {
  const res = await apiFetch('/api/chat/rooms/')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to load rooms')
  }
  return res.json()
}

export async function forwardMessage(roomId: string, sourceMessageId: string) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forwarded_from_id: sourceMessageId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to forward message')
  }
  return res.json()
}

export async function searchUsers(query: string) {
  const res = await apiFetch(`/api/accounts/search/?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to search users')
  }
  return res.json()
}

export async function inviteUsers(roomId: string, usernames: string[], emails: string[]) {
  const res = await apiFetch(`/api/chat/rooms/${roomId}/invite/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames, emails }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to invite users')
  }
  return res.json()
}

export async function fetchDirectRequests() {
  const res = await apiFetch('/api/chat/direct/requests/')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to load direct chat requests')
  }
  return res.json()
}

export async function createDirectRequest(toUserId: string, message: string) {
  const res = await apiFetch('/api/chat/direct/requests/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_user: toUserId, message }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to start direct chat')
  }
  return res.json()
}

export async function decideDirectRequest(requestId: string, decision: 'accept' | 'decline') {
  const res = await apiFetch(`/api/chat/direct/requests/${requestId}/decision/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Unable to update request')
  }
  return res.json()
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
