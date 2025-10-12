//frontend/web/src/pages/InviteUsersInRoom.tsx

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

const SEARCH_URL   = import.meta.env.VITE_USERS_SEARCH_URL as string | undefined
const SEARCH_PARAM = (import.meta.env.VITE_USERS_SEARCH_PARAM as 'q' | 'search' | undefined) ?? 'search'
const INVITE_URL   = (import.meta.env.VITE_INVITE_USERS_URL as string | undefined) ?? '/api/chat/rooms/:roomId/invite/'

function buildInviteUrl(roomId: string) {
  return INVITE_URL.replace(':roomId', roomId)
}

export default function InviteUsersInRoom() {
  const { token, user } = useAuth()
  const { roomId = '' } = useParams()
  const navigate = useNavigate()

  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<UserLite[]>([])
  const [selected, setSelected] = React.useState<UserLite[]>([])
  const [manual, setManual] = React.useState('') // email or username fallback
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const searchEnabled = Boolean(SEARCH_URL && token)

  React.useEffect(() => {
    if (!searchEnabled || !q.trim()) { setResults([]); return }
    let cancel = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = `${SEARCH_URL}?${SEARCH_PARAM}=${encodeURIComponent(q.trim())}`
        const r = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) {
          // If your backend returns 404 here, we just hide results and stop searching
          if (r.status === 404) { setResults([]); return }
          throw new Error(`Search failed (${r.status})`)
        }
        const data = await r.json()
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        const normalized: UserLite[] = list
          .map((u: any) => ({
            id: u.id ?? u.pk ?? u.user_id,
            name: u.name ?? u.full_name,
            username: u.username,
            email: u.email,
            avatar_url: u.avatar_url,
          }))
          .filter(u => String(u.id) !== String(user?.id))
        if (!cancel) setResults(normalized)
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? 'Search failed')
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    const t = setTimeout(run, 300)
    return () => { cancel = true; clearTimeout(t) }
  }, [q, token, user?.id, searchEnabled])

  function isPicked(id: UserLite['id']) {
    return selected.some(s => String(s.id) === String(id))
  }
  function togglePick(u: UserLite) {
    setSelected(prev => isPicked(u.id) ? prev.filter(p => String(p.id) !== String(u.id)) : [...prev, u])
  }
  function removeChip(id: UserLite['id']) {
    setSelected(prev => prev.filter(p => String(p.id) !== String(id)))
  }
  function nameOrHandle(u: UserLite) {
    return u.name || u.username || u.email || `User ${u.id}`
  }
  function initials(u: UserLite) {
    const n = (u.name || u.username || 'U').trim()
    return n.slice(0, 1).toUpperCase()
  }
async function inviteBySelection() {
  if (!token) return
  setSubmitting(true); setError(null)
  try {
    const usernames = selected
      .map(s => s.username)
      .filter(Boolean)

    const emails = selected
      .map(s => s.email)
      .filter(Boolean)

    const body = { usernames, emails }

    const r = await apiFetch(buildInviteUrl(roomId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!r.ok) throw new Error((await safeMessage(r)) || 'Failed to invite users')
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
    ? { emails: [val] }
    : { usernames: [val] }

  try {
    const r = await apiFetch(buildInviteUrl(roomId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error((await safeMessage(r)) || 'Manual invite failed')
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

        {/* Search (only if configured) */}
        {searchEnabled && (
          <>
            <div className="inv-search">
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by name, username or email…"
                autoFocus
              />
            </div>

            <div className="inv-results">
              {loading && <div className="hint">Searching…</div>}
              {!loading && q && results.length === 0 && (
                <div className="hint">No users found.</div>
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
          </>
        )}

        {/* Manual invite always available */}
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
          onClick={inviteBySelection}
        >
          {submitting ? 'Inviting…' : `Invite ${selected.length || ''}`}
        </button>
      </footer>
    </div>
  )
}

async function safeMessage(res: Response) {
  try { const j = await res.json(); return j?.detail || j?.message } catch { return null }
}
