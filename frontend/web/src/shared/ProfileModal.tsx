// frontend/web/src/shared/ProfileModal.tsx
import React from 'react'
import { apiFetch } from './api'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { getInitials } from './utils'
import './profileModal.css'

type TabKey = 'account' | 'security' | 'preferences' | 'sessions'

type SessionItem = {
  id: string | number
  ip?: string
  user_agent?: string
  created_at?: string
  last_seen?: string
  current?: boolean
  device?: string
  location?: string
}

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, token, setUser, logout } = useAuth()
  const [tab, setTab] = React.useState<TabKey>('account')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  // form state
  const [firstName, setFirstName] = React.useState(user?.first_name || '')
  const [lastName, setLastName] = React.useState(user?.last_name || '')
  const [email, setEmail] = React.useState(user?.email || '')
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(user?.avatar || null)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)

  // password state
  const [currentPwd, setCurrentPwd] = React.useState('')
  const [newPwd, setNewPwd] = React.useState('')
  const [confirmPwd, setConfirmPwd] = React.useState('')

  // sessions
  const [sessions, setSessions] = React.useState<SessionItem[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = React.useState(false)

  // close automatically if auth disappears
  React.useEffect(() => {
    if (!token) onClose()
  }, [token, onClose])

  // close on ESC
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  function clearMessages() {
    setMsg(null)
    setErr(null)
  }

  function onPickAvatar(file?: File) {
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  /** Save profile with PATCH→PUT→endpoint-fallback so 405/404 backends work */
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    setBusy(true)
    try {
      const body = JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
      })

      // Try PATCH then PUT on the same endpoint, then a couple common fallbacks
      const endpoints = [
        { url: '/api/accounts/me/', method: 'PATCH' as const },
        { url: '/api/accounts/me/', method: 'PUT' as const },
        { url: '/api/accounts/profile/', method: 'PATCH' as const },
        { url: '/api/accounts/profile/', method: 'PUT' as const },
        { url: '/api/accounts/me/update/', method: 'POST' as const },
      ]

      let updatedUser: any | null = null
      let lastError: Error | null = null

      for (const { url, method } of endpoints) {
        try {
          const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body,
          })
          if (!res.ok) throw await errorFromResponse(res, `${method} ${url} failed`)
          updatedUser = await res.json()
          break
        } catch (e: any) {
          lastError = e
          // continue to next fallback
        }
      }

      if (!updatedUser) throw lastError || new Error('Profile update failed')

      setUser?.(updatedUser)

      // Upload avatar if present
      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        const r2 = await apiFetch('/api/accounts/avatar/', {
          method: 'POST',
          headers: { ...authHeaders }, // let browser set boundary
          body: fd,
        })
        if (!r2.ok) throw await errorFromResponse(r2, 'Failed to upload avatar')
        const updated2 = await r2.json()
        setUser?.(updated2)
        setAvatarFile(null)
        setAvatarPreview(updated2.avatar || avatarPreview)
      }

      setMsg('Profile saved 🎉')
    } catch (e: any) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  /** Change password trying several common endpoints/payloads */
  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (newPwd !== confirmPwd) {
      setErr('New passwords do not match')
      return
    }
    setBusy(true)
    try {
      // Candidates (path + payload resolver)
      const attempts: Array<{
        url: string
        payload: () => any
      }> = [
        {
          url: '/api/accounts/password/change/',
          payload: () => ({ current_password: currentPwd, new_password: newPwd }),
        },
        {
          url: '/api/accounts/change-password/',
          payload: () => ({ old_password: currentPwd, new_password1: newPwd, new_password2: confirmPwd }),
        },
        {
          url: '/api/accounts/password/',
          payload: () => ({ old_password: currentPwd, new_password: newPwd }),
        },
      ]

      let ok = false
      let lastError: Error | null = null

      for (const a of attempts) {
        try {
          const res = await apiFetch(a.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(a.payload()),
          })
          if (!res.ok) throw await errorFromResponse(res, `POST ${a.url} failed`)
          ok = true
          break
        } catch (e: any) {
          lastError = e
        }
      }

      if (!ok) throw lastError || new Error('Could not change password')

      setMsg('Password changed ✅')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (e: any) {
      setErr(e.message || 'Change password failed')
    } finally {
      setBusy(false)
    }
  }

  /** Load sessions on demand with flexible endpoints & shapes */
  React.useEffect(() => {
    if (tab !== 'sessions' || !token) return
    const controller = new AbortController()
    ;(async () => {
      setSessionsLoading(true)
      clearMessages()
      try {
        const paths = [
          '/api/accounts/sessions/',
          '/api/accounts/me/sessions/',
          '/api/sessions/',
        ]
        let data: any = []
        let success = false
        let lastError: Error | null = null

        for (const p of paths) {
          try {
            const r = await apiFetch(p, { headers: { ...authHeaders }, signal: controller.signal })
            if (!r.ok) throw await errorFromResponse(r, `GET ${p} failed`)
            const json = await r.json()
            data = Array.isArray(json) ? json : (json?.results ?? json?.items ?? [])
            success = true
            break
          } catch (e: any) {
            lastError = e
          }
        }
        if (!success) throw lastError || new Error('Failed to load sessions')

        // normalize a bit
        const normalized: SessionItem[] = (data || []).map((s: any) => ({
          id: s.id ?? s.session_id ?? s.key ?? String(Math.random()),
          ip: s.ip ?? s.ip_address ?? s.remote_addr,
          user_agent: s.user_agent ?? s.ua,
          created_at: s.created_at ?? s.created ?? s.start ?? s.started_at,
          last_seen: s.last_seen ?? s.updated_at ?? s.last_activity,
          current: !!(s.current ?? s.is_current ?? s.this_device),
          device: s.device ?? guessDevice(s.user_agent),
          location: s.location ?? s.geo,
        }))
        setSessions(normalized)
      } catch (e: any) {
        setErr(e.message || 'Could not load sessions')
        setSessions([])
      } finally {
        setSessionsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [tab, token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function revokeSession(id: string | number) {
    clearMessages()
    setBusy(true)
    try {
      const paths = [
        `/api/accounts/sessions/${id}/`,
        `/api/sessions/${id}/`,
        `/api/accounts/me/sessions/${id}/`,
      ]
      let ok = false
      for (const p of paths) {
        const res = await apiFetch(p, { method: 'DELETE', headers: { ...authHeaders } })
        if (res.ok) { ok = true; break }
      }
      if (!ok) throw new Error('Failed to revoke session')
      setSessions(s => (s ? s.filter(x => String(x.id) !== String(id)) : s))
      setMsg('Session revoked')
    } catch (e: any) {
      setErr(e.message || 'Could not revoke session')
    } finally {
      setBusy(false)
    }
  }

  async function logoutAllDevices() {
    clearMessages()
    setBusy(true)
    try {
      const paths = ['/api/accounts/logout-all/', '/api/accounts/sessions/logout-all/']
      let ok = false
      for (const p of paths) {
        const res = await apiFetch(p, { method: 'POST', headers: { ...authHeaders } })
        if (res.ok) { ok = true; break }
      }
      if (!ok) throw new Error('Failed to log out from other devices')
      setMsg('Logged out from all devices')
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    clearMessages()
    try {
      await Promise.resolve(logout?.())
    } finally {
      onClose()
    }
  }

  return (
    <div className="pm-backdrop" onMouseDown={onClose} aria-modal="true" role="dialog">
      <div className="pm-modal" onMouseDown={(e) => e.stopPropagation()} role="document">
        {/* Header */}
        <header className="pm-header">
          <div className="pm-title">
            <span className="pm-logo">TuChati</span>
            <h3>Profile & Settings</h3>
          </div>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {/* Tabs */}
        <nav className="pm-tabs" aria-label="Profile sections">
          <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>Account</button>
          <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>Security</button>
          <button className={tab === 'preferences' ? 'active' : ''} onClick={() => setTab('preferences')}>Preferences</button>
          <button className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>Sessions</button>
        </nav>

        {(msg || err) && <div className={`pm-alert ${err ? 'error' : 'ok'}`}>{err || msg}</div>}

        <div className="pm-body">
          {tab === 'account' && (
            <form className="pm-form" onSubmit={saveProfile}>
              <div className="pm-grid">
                <div className="pm-avatar-col">
                  <div className="pm-avatar">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" />
                    ) : (
                      <div className="pm-avatar-fallback">
                        {getInitials(user?.first_name, user?.last_name, user?.username)}
                      </div>
                    )}
                  </div>
                  <label className="pm-file">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickAvatar(e.target.files?.[0] || undefined)}
                    />
                    Change avatar
                  </label>
                </div>

                <div className="pm-fields">
                  <label>
                    <span>First name</span>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </label>
                  <label>
                    <span>Last name</span>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </label>

                  {/* Username is read-only for now */}
                  <label>
                    <span>Username</span>
                    <input value={user?.username || ''} readOnly />
                    <small className="pm-hint"> Changes allowed after 3 months.</small>
                  </label>

                  <label>
                    <span>Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="pm-actions">
                <button className="btn primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}

          {tab === 'security' && (
            <form className="pm-form narrow" onSubmit={changePassword}>
              <label>
                <span>Current password</span>
                <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
              </label>
              <label>
                <span>New password</span>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </label>
              <label>
                <span>Confirm new password</span>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
              </label>

              <div className="pm-actions">
                <button className="btn primary" type="submit" disabled={busy}>
                  {busy ? 'Updating…' : 'Change password'}
                </button>
              </div>
            </form>
          )}

          {tab === 'preferences' && (
            <div className="pm-preferences">
              <div className="pref-row">
                <div>
                  <h4>Theme</h4>
                  <p>Choose light or dark appearance.</p>
                </div>
                <ThemeSwitcher />
              </div>
              <div className="pref-row">
                <div>
                  <h4>Language</h4>
                  <p>Change the interface language.</p>
                </div>
                <LanguageSwitcher />
              </div>
              <div className="pref-row">
                <div>
                  <h4>Notifications</h4>
                  <p>Receive in-app notifications.</p>
                </div>
                <label className="switch">
                  <input type="checkbox" defaultChecked />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="pm-sessions">
              {sessionsLoading && <p>Loading sessions…</p>}
              {!sessionsLoading && (!sessions || sessions.length === 0) && <p>No active sessions.</p>}

              {!sessionsLoading && sessions && sessions.length > 0 && (
                <ul className="pm-session-list">
                  {sessions.map(s => (
                    <li key={String(s.id)} className={`pm-session ${s.current ? 'current' : ''}`}>
                      <div className="pm-session-main">
                        <strong>{s.device || s.user_agent || 'Unknown device'}</strong>
                        {s.current && <span className="pm-tag">This device</span>}
                      </div>
                      <div className="pm-session-meta">
                        {s.ip && <span>IP: {s.ip}</span>}
                        {s.location && <span> · {s.location}</span>}
                        {(s.last_seen || s.created_at) && (
                          <span> · Last seen: {niceDate(s.last_seen || s.created_at)}</span>
                        )}
                      </div>
                      {!s.current && (
                        <button
                          className="btn danger ghost"
                          onClick={() => revokeSession(s.id)}
                          disabled={busy}
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="pm-actions">
                <button className="btn" onClick={handleLogout} disabled={busy}>Log out</button>
                <button className="btn danger" onClick={logoutAllDevices} disabled={busy}>
                  Log out all devices
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Helpers */
function guessDevice(ua?: string) {
  if (!ua) return ''
  const u = ua.toLowerCase()
  if (u.includes('iphone') || u.includes('ios')) return 'iPhone'
  if (u.includes('ipad')) return 'iPad'
  if (u.includes('android')) return 'Android'
  if (u.includes('mac os') || u.includes('macintosh')) return 'Mac'
  if (u.includes('windows')) return 'Windows'
  if (u.includes('linux')) return 'Linux'
  return ''
}

function niceDate(d?: string) {
  try {
    return new Date(d as string).toLocaleString()
  } catch {
    return d || ''
  }
}

async function errorFromResponse(res: Response, fallback: string) {
  try {
    const data = await res.clone().json()
    const msg =
      data?.detail ||
      (typeof data === 'string' ? data : null) ||
      Object.values(data || {}).flat().join(' ')
    return new Error(msg || `${fallback} (${res.status})`)
  } catch {
    return new Error(`${fallback} (${res.status})`)
  }
}
