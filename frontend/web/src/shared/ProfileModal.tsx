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

  // account form
  const [firstName, setFirstName] = React.useState(user?.first_name || '')
  const [lastName, setLastName] = React.useState(user?.last_name || '')
  const [username, setUsername] = React.useState(user?.username || '')
  const [email, setEmail] = React.useState(user?.email || '')
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(user?.avatar || null)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)

  // password form
  const [currentPwd, setCurrentPwd] = React.useState('')
  const [newPwd, setNewPwd] = React.useState('')
  const [confirmPwd, setConfirmPwd] = React.useState('')

  // sessions
  const [sessions, setSessions] = React.useState<SessionItem[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = React.useState(false)

  // Auto-close when logged out
  React.useEffect(() => {
    if (!token) onClose()
  }, [token, onClose])

  // Close on ESC
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load sessions when tab opens
  React.useEffect(() => {
    if (tab !== 'sessions' || !token) return
    const controller = new AbortController()
    ;(async () => {
      try {
        setSessionsLoading(true)
        setErr(null)
        const res = await apiFetch('/api/accounts/sessions/', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!res.ok) {
          // Graceful 404 handling (backend not exposing sessions)
          if (res.status === 404) {
            setSessions([])
            setErr('Sessions endpoint not available (404)')
          } else {
            throw await errorFromResponse(res, 'Failed to load sessions')
          }
        } else {
          const data = await res.json()
          setSessions(Array.isArray(data) ? data : (data?.results ?? []))
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') setErr(e.message || 'Failed to load sessions')
      } finally {
        setSessionsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [tab, token])

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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    setBusy(true)
    try {
      const res = await apiFetch('/api/accounts/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username,
          email,
        }),
      })
      if (!res.ok) throw await errorFromResponse(res, 'Failed to update profile')
      const updated = await res.json()
      setUser?.(updated)

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

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (newPwd !== confirmPwd) {
      setErr('New passwords do not match')
      return
    }
    setBusy(true)
    try {
      // Primary payload
      let res = await apiFetch('/api/accounts/password/change/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
        }),
      })

      // Fallback common payload (Django allauth/rest-auth style)
      if (!res.ok) {
        res = await apiFetch('/api/accounts/password/change/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            old_password: currentPwd,
            new_password1: newPwd,
            new_password2: confirmPwd,
          }),
        })
      }

      if (!res.ok) throw await errorFromResponse(res, 'Could not change password')

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

  async function logoutAllDevices() {
    clearMessages()
    setBusy(true)
    try {
      const res = await apiFetch('/api/accounts/logout-all/', {
        method: 'POST',
        headers: { ...authHeaders },
      })
      if (!res.ok) throw await errorFromResponse(res, 'Failed to log out from other devices')
      setMsg('Logged out from all devices')
      onClose() // close modal after global logout
    } catch (e: any) {
      setErr(e.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function revokeSession(id: string | number) {
    clearMessages()
    setBusy(true)
    try {
      const res = await apiFetch(`/api/accounts/sessions/${id}/`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      })
      if (!res.ok) throw await errorFromResponse(res, 'Failed to revoke session')
      setSessions(s => (s ? s.filter(x => String(x.id) !== String(id)) : s))
      setMsg('Session revoked')
    } catch (e: any) {
      setErr(e.message || 'Could not revoke session')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    clearMessages()
    try {
      await Promise.resolve(logout?.()) // support sync/async
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

        {/* Alerts */}
        {(msg || err) && <div className={`pm-alert ${err ? 'error' : 'ok'}`}>{err || msg}</div>}

        {/* Body */}
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
                  <label>
                    <span>Username</span>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} />
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

              {!sessionsLoading && sessions && sessions.length === 0 && (
                <p>No active sessions found.</p>
              )}

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
                          <span> · Last seen: {s.last_seen || s.created_at}</span>
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

/** Build a readable error from a fetch Response */
async function errorFromResponse(res: Response, fallback: string) {
  try {
    const data = await res.clone().json()
    const msg =
      data?.detail ||
      (typeof data === 'string' ? data : null) ||
      Object.values(data || {})
        .flat()
        .join(' ')
    return new Error(msg || `${fallback} (${res.status})`)
  } catch {
    return new Error(`${fallback} (${res.status})`)
  }
}
