//
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
  // Search: adjust to your backend (common patterns shown):
  // e.g. /api/users/?q=alice  OR  /api/accounts/users/?search=alice
  searchUsers: (q: string) => `/api/users/?q=${encodeURIComponent(q)}`,

  // Invite: many backends differ. We try #1 and fallback to #2 automatically:
  inviteUsersPreferred: (roomId: string) => `/api/chat/rooms/${roomId}/invite/`,         // expect { users: [ids] } OR { email }
  inviteUsersFallback:  (roomId: string) => `/api/chat/rooms/${roomId}/members/`,        // expect { user_ids: [...] } (POST)
}

export default function InviteUsersInRoom() {
  const { token } = useAuth()
  const { roomId = '' } = useParams()
  const navigate = useNavigate()

  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<UserLite[]>([])
  const [selected, setSelected] = React.useState<UserLite[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Debounced search
  React.useEffect(() => {
    if (!token) return
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(ENDPOINTS.searchUsers(q.trim()), {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = r.ok ? await r.json() : []
        // normalize a bit
        const list: UserLite[] = (Array.isArray(data) ? data : (data?.results ?? []))?.map((u: any) => ({
          id: u.id ?? u.pk ?? u.user_id,
          name: u.name ?? u.full_name,
          username: u.username,
          email: u.email,
          avatar_url: u.avatar_url,
        }))
        setResults(list)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, token])

  const isPicked = (id: UserLite['id']) => selected.some(s => String(s.id) === String(id))

  const togglePick = (u: UserLite) => {
    setSelected(prev => isPicked(u.id) ? prev.filter(p => String(p.id) !== String(u.id)) : [...prev, u])
  }

  const removeChip = (id: UserLite['id']) => {
    setSelected(prev => prev.filter(p => String(p.id) !== String(id)))
  }

  const inviteSelected = async () => {
    if (!selected.length || !token) return
    setSubmitting(true); setError(null)
    const ids = selected.map(s => s.id)

    // We’ll try your preferred endpoint first; if it 404’s we fallback.
    const tryInvite = async (url: string, body: any) => {
      const r = await apiFetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return r
    }

    try {
      // Preferred: { users: [ids] }
      let res = await tryInvite(ENDPOINTS.inviteUsersPreferred(roomId), { users: ids })
      if (res.status === 404) {
        // Fallback common pattern: { user_ids: [ids] }
        res = await tryInvite(ENDPOINTS.inviteUsersFallback(roomId), { user_ids: ids })
      }
      if (!res.ok) {
        const msg = await safeMessage(res)
        throw new Error(msg || 'Failed to invite users')
      }
      navigate(-1) // back to room
    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Failed to invite users')
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

        {/* Search box */}
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
            <div className="hint">No users match “{q}”.</div>
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

function nameOrHandle(u: UserLite) {
  return u.name || u.username || u.email || `User ${u.id}`
}
function initials(u: UserLite) {
  const n = (u.name || u.username || 'U').trim()
  return n.slice(0, 1).toUpperCase()
}
async function safeMessage(res: Response) {
  try { const j = await res.json(); return j?.detail || j?.message } catch { return null }
}
