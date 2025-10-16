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

      if (data?.uid) setResetUid(String(data.uid))
      if (data?.token) setResetToken(String(data.token))
      if (data?.email) setResetIdentifier(String(data.email))
      switchMode('reset-confirm')
      setInfo(data?.detail || 'Reset instructions sent. Paste the code below to finish.')
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
      setLoginIdentifier(resetIdentifier || loginIdentifier)
      switchMode('reset-success')
      setInfo('Password updated! You can log in with your new password now.')
    } catch (err: any) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  const titleMap: Record<Mode, string> = {
    login: 'Login',
    signup: 'Create account',
    'reset-request': 'Forgot password',
    'reset-confirm': 'Set a new password',
    'reset-success': 'Password updated',
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
          <h3>{titleMap[mode]}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Username or Email
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                placeholder="your username or email"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <div className="pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('reset-request')}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              Username
              <input
                type="text"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                required
                placeholder="choose a username"
                autoComplete="username"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                placeholder="you@tuunganes.com"
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <div className="pwd-wrap">
                <input
                  type={showSignupPwd ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowSignupPwd(v => !v)}
                  aria-label={showSignupPwd ? 'Hide password' : 'Show password'}
                  title={showSignupPwd ? 'Hide password' : 'Show password'}
                >
                  {showSignupPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            <label>
              Confirm Password
              <div className="pwd-wrap">
                <input
                  type={showSignupPwd2 ? 'text' : 'password'}
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowSignupPwd2(v => !v)}
                  aria-label={showSignupPwd2 ? 'Hide password' : 'Show password'}
                  title={showSignupPwd2 ? 'Hide password' : 'Show password'}
                >
                  {showSignupPwd2 ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        {mode === 'reset-request' && (
          <form className="auth-form" onSubmit={handleResetRequest}>
            <p className="auth-info small">
              Enter the email or username linked to your TuChati account. We’ll generate a reset code for you.
            </p>
            <label>
              Email or Username
              <input
                type="text"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </form>
        )}

        {mode === 'reset-confirm' && (
          <form className="auth-form" onSubmit={handleResetConfirm}>
            <p className="auth-info small">
              Paste the reset code you received. For testing, we also display the latest code returned by the server.
            </p>
            <label>
              Account ID (uid)
              <input
                type="text"
                value={resetUid}
                onChange={(e) => setResetUid(e.target.value)}
                required
                placeholder="Paste uid"
              />
            </label>
            <label>
              Reset token
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
                placeholder="Paste token"
              />
            </label>
            <label>
              New password
              <div className="pwd-wrap">
                <input
                  type={showResetPwd ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowResetPwd(v => !v)}
                  aria-label={showResetPwd ? 'Hide password' : 'Show password'}
                  title={showResetPwd ? 'Hide password' : 'Show password'}
                >
                  {showResetPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
            <label>
              Confirm new password
              <div className="pwd-wrap">
                <input
                  type={showResetPwd2 ? 'text' : 'password'}
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowResetPwd2(v => !v)}
                  aria-label={showResetPwd2 ? 'Hide password' : 'Show password'}
                  title={showResetPwd2 ? 'Hide password' : 'Show password'}
                >
                  {showResetPwd2 ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        )}

        {mode === 'reset-success' && (
          <div className="auth-form">
            {info && <p className="auth-info">{info}</p>}
            <button className="btn primary" type="button" onClick={() => switchMode('login')}>
              Back to login
            </button>
          </div>
        )}

        <div className="auth-switch">
          {mode === 'login' && (
            <button className="link-btn" onClick={() => switchMode('signup')}>
              Need an account? Sign up
            </button>
          )}

          {mode === 'signup' && (
            <button className="link-btn" onClick={() => switchMode('login')}>
              Have an account? Login
            </button>
          )}

          {mode === 'reset-request' && (
            <button className="link-btn" onClick={() => switchMode('login')}>
              Back to login
            </button>
          )}

          {mode === 'reset-confirm' && (
            <button className="link-btn" onClick={() => switchMode('reset-request')}>
              Need a new code?
            </button>
          )}

          {mode === 'reset-success' && (
            <button className="link-btn" onClick={() => switchMode('login')}>
              Return to login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
