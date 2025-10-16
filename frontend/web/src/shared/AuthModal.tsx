// src/shared/AuthModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './AuthModal.css'
import { apiFetch } from './api'

type Mode = 'login' | 'signup' | 'reset-request' | 'reset-confirm' | 'reset-success'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('login')

  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [signupUsername, setSignupUsername] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [showSignupPwd, setShowSignupPwd] = useState(false)
  const [showSignupPwd2, setShowSignupPwd2] = useState(false)

  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetUid, setResetUid] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [showResetPwd2, setShowResetPwd2] = useState(false)

  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const resetNotices = () => {
    setError('')
    setInfo('')
    setLoading(false)
  }

  const switchMode = (next: Mode) => {
    resetNotices()
    setMode(next)

    if (next === 'login') {
      setPassword('')
      setShowPwd(false)
    }
    if (next === 'reset-request') {
      setResetIdentifier(loginIdentifier || '')
      setResetUid('')
      setResetToken('')
      setResetPassword('')
      setResetPasswordConfirm('')
      setShowResetPwd(false)
      setShowResetPwd2(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)

    try {
      await login(loginIdentifier, password)
      onClose()
      navigate('/chat')
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)

    try {
      const res = await apiFetch('/api/accounts/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          password: signupPassword,
          password2: signupConfirmPassword || signupPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data?.password2?.[0] ||
          data?.email?.[0] ||
          data?.username?.[0] ||
          data?.detail ||
          'Registration failed.'
        throw new Error(msg)
      }

      await login(signupEmail || signupUsername, signupPassword)
      onClose()
      navigate('/chat')
    } catch (err: any) {
      setError(err.message || 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)
    try {
      const payload = {
        email: resetIdentifier,
        username: resetIdentifier,
        identifier: resetIdentifier,
      }
      const res = await apiFetch('/api/accounts/password/reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        skipAuth: true,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || 'Could not start reset flow.')
      }

      setInfo(data?.detail || 'Reset instructions sent.')
      if (data?.uid) setResetUid(String(data.uid))
      if (data?.token) setResetToken(String(data.token))
      if (!resetIdentifier) setResetIdentifier(data?.email || '')
      switchMode('reset-confirm')
    } catch (err: any) {
      setError(err.message || 'Could not start reset flow.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetConfirm(e: React.FormEvent) {
    e.preventDefault()
    resetNotices()

    if (resetPassword !== resetPasswordConfirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/accounts/password/reset/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: resetUid,
          token: resetToken,
          new_password: resetPassword,
        }),
        skipAuth: true,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.password?.[0] || data?.detail || 'Unable to reset password.'
        throw new Error(msg)
      }
      setInfo('Password updated! You can log in with your new password now.')
      setLoginIdentifier(resetIdentifier || loginIdentifier)
      switchMode('reset-success')
    } catch (err: any) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-header">
          <h3>{mode === 'login' ? 'Login' : 'Create account'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="choose a username"
                  autoComplete="username"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@tuunganes.com"
                  autoComplete="email"
                />
              </label>
            </>
          )}

          {mode === 'login' && (
            <label>
              Username or Email
              <input
                type="text"
                value={username || email}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setEmail(e.target.value)
                }}
                required
                placeholder="your username or email"
                autoComplete="username"
              />
            </label>
          )}

          <label>
            Password
            <div className="pwd-wrap">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                title={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {mode === 'signup' && (
            <label>
              Confirm Password
              <div className="pwd-wrap">
                <input
                  type={showPwd2 ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd2(v => !v)}
                  aria-label={showPwd2 ? 'Hide password' : 'Show password'}
                  title={showPwd2 ? 'Hide password' : 'Show password'}
                >
                  {showPwd2 ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
          )}

          {error && (
            <p className="auth-error">{error}</p>
          )}

          <button className="btn primary" type="submit" disabled={loading}>
            {loading
              ? mode === 'login'
                ? 'Logging in...'
                : 'Creating account...'
              : mode === 'login'
              ? 'Login'
              : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <button className="link-btn" onClick={() => setMode('signup')}>
              Need an account? Sign up
            </button>
          ) : (
            <button className="link-btn" onClick={() => setMode('login')}>
              Have an account? Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
