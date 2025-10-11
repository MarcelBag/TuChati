import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../shared/api'
import { useAuth } from '../context/AuthContext'
import './InviteUsersInRoom.css'

type UserLite = {
  id: number | string
  name?: string
  username?: string
  email?: string
  avatar_url?: string
}

const ENDPOINTS = {
  inviteUsersPreferred: (roomId: string) => `/api/chat/rooms/${roomId}/invite/`,   // { users: [ids] } or { email }
  inviteUsersFallback:  (roomId: string) => `/api/chat/rooms/${roomId}/members/`,  // { user_ids: [...] }
}

/**
 * Common user-search candidates. We’ll try these in order until one returns 200.
 * If you know your real route, put it as the first entry and it’ll be used quickly.
 */
const SEARCH_CANDIDATES: { url: string; param: 'q' | 'search'; label: string }[] = [
  { url: '/api/users/',              param: 'search', label: 'users?search=' },
  { url: '/api/users/search/',       param: 'q',      label: 'users/search?q=' },
  { url: '/api/accounts/users/',     param: 'search', label: 'accounts/users?search=' },
  { url: '/api/auth/users/',         param: 'search', label: 'auth/users?search=' },
  { url: '/api/chat/users/',         param: 'q',      label: 'chat/users?q=' },
  { url: '/api/profiles/',           param: 'search', label: 'profiles?search=' },
]

export default function InviteUsersInRoom() {
  const { token, user } = useAuth()
  const { roomId = '' } = useParams()
  const navigate = useNavigate()

  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<UserLite[]>([])
  const [selected, setSelected] = React.useState<UserLite[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // autodiscovery cache (kept in memory while page is mounted)
  const discoveredRef = React.useRef<null | { url: string; param: 'q' | 'search'; label: string }>(null)

  // Manual invite fallback
  const [manual, setManual] = React.useState('') // email or username

  React.useEffect(() => {
    if (!token) return
    if (!q.trim()) { setResults([]); return }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const list = await autoSearchUsers(q.trim(), token)
        if (cancelled) return
        // Normalize + filter out self
        const norm: UserLite[] = list
          .map((u: any) => ({
            id: u.id ?? u.pk ?? u.user_id,
            name: u.name ?? u.full_name,
            username: u.username,
            email: u.email,
            avatar_url: u.avatar_url,
          }))
          .filter(u => String(u.id) !== String(user?.id))
        setResults(norm)
      } catch (e) {
        if (!cancelled) console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(run, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, token, user?.id])

  async function autoSearchUsers(query: string, token: string) {
    // 1) use already-discovered working endpoint
    if (discoveredRef.current) {
      const { url, param } = discoveredRef.current
      const full = `${url}?${param}=${encodeURIComponent(query)}`
      const r = await apiFetch(full, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(`Search failed on ${full} (${r.status})`)
      return await toArray(await r.json())
    }

    // 2) try candidates until one returns 200; remember it
    for (const cand of SEARCH_CANDIDATES) {
      const full = `${cand.url}?${cand.param}=${encodeURIComponent(query)}`
      try {
        const r = await apiFetch(full, { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) {
          discoveredRef.current = cand // cache working route
          return await toArray(await r.json())
        }
        // ignore 404/403 etc and try next
      } catch { /* ignore and try next */ }
    }
    // 3) nothing worked — return empty
    return []
  }

  function isPicked(id: UserLite['id']) {
    return selected.some(s => String(s.id) === String(id))
  }

  function togglePick(u: UserLite) {
    setSelected(prev => isPicked(u.id) ? prev.filter(p => String(p.id) !== String(u.id)) : [...prev, u])
  }

  function removeChip(id: UserLite['id']) {
    setSelected(prev => prev.filter(p => String(p.id) !== String(id)))
  }

  async function inviteSelected() {
    if (!token) return
    setSubmitting(true); setError(null)

    try {
      // Preferred payload: { users: [ids] }
      const ids = selected.map(s => s.id)
      let res = await postJSON(ENDPOINTS.inviteUsersPreferred(roomId), token, { users: ids })
      if (res.status === 404) {
        // Fallback payload: { user_ids: [ids] }
        res = await postJSON(ENDPOINTS.inviteUsersFallback(roomId), token, { user_ids: ids })
      }
      if (!res.ok) throw new Error(await safeMessage(res) || 'Failed to invite users')
      navigate(-1)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to invite users')
    } finally {
      setSubmitting(false)
    }
  }

  async function inviteManual() {
    if (!token || !manual.trim()) return
    setSubmitting(true); setError(null)
    const val = manual.trim()
    const body = val.includes('@')
      ? { email: val }
      : { username: val }

    try {
      let res = await postJSON(ENDPOINTS.inviteUsersPreferred(roomId), token, body)
      if (res.status === 404) {
        // If your fallback only accepts ids, this won’t work — but we try:
        res = await postJSON(ENDPOINTS.inviteUsersFallback(roomId), token, body)
      }
      if (!res.ok) throw new Error(await safeMessage(res) || 'Manual invite failed')
      navigate(-1)
    } catch (e: any) {
      setError(e?.message ?? 'Manual invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="invite-shell">
      <header className="invite-hd">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="inv-title">Invite users</div>
        <div />
      </header>

      <div className="inv-body">
        {/* Selected chips */}
        <div className="chips">
          {selected.map(s => (
            <span className="chip" key={String(s.id)}>
              {nameOrHandle(s)}
              <button className="chip-x" onClick={() => removeChip(s.id)} aria-label="Remove">×</button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="inv-search">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, username or email…"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="inv-results">
          {loading && <div className="hint">Searching…</div>}
          {!loading && q && results.length === 0 && (
            <div className="hint">
              No users found. You can also invite manually below.
            </div>
          )}
          <ul>
            {results.map(u => (
              <li
                key={String(u.id)}
                className={`row ${isPicked(u.id) ? 'picked' : ''}`}
                onClick={() => togglePick(u)}
              >
                <div className="avatar">{initials(u)}</div>
                <div className="meta">
                  <div className="line1">{nameOrHandle(u)}</div>
                  <div className="line2">{u.email || u.username}</div>
                </div>
                <div className="mark">{isPicked(u.id) ? '✓' : ''}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Manual invite fallback */}
        <div className="manual-invite">
          <div className="label">Invite by email or username</div>
          <div className="row">
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder="e.g. alice@example.com or admin1"
            />
            <button className="btn" onClick={inviteManual} disabled={!manual.trim() || submitting}>
              Send invite
            </button>
          </div>
        </div>

        {error && <div className="inv-error">{error}</div>}
      </div>

      <footer className="inv-foot">
        <button
          className="btn primary"
          disabled={!selected.length || submitting}
          onClick={inviteSelected}
        >
          {submitting ? 'Inviting…' : `Invite ${selected.length || ''}`}
        </button>
      </footer>
    </div>
  )
}

/* Helpers */

function nameOrHandle(u: UserLite) {
  return u.name || u.username || u.email || `User ${u.id}`
}
function initials(u: UserLite) {
  const n = (u.name || u.username || 'U').trim()
  return n.slice(0, 1).toUpperCase()
}
async function toArray(data: any) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}
async function postJSON(url: string, token: string, body: any) {
  return apiFetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
async function safeMessage(res: Response) {
  try { const j = await res.json(); return j?.detail || j?.message } catch { return null }
}
