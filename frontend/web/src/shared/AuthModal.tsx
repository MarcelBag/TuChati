// src/shared/AuthModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './auth.css'
import { apiFetch } from './api'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        // --- Registration ---
        const res = await apiFetch('/api/accounts/register/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            email,
            password,
            password2: confirmPassword || password,
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
      }

      // --- Login (JWT) ---
      // backend expects username/password, but allow user to enter either username or email
      await login(username || email, password)

      onClose()
      navigate('/chat')
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
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
              />
            </label>
          )}

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          {mode === 'signup' && (
            <label>
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat password"
              />
            </label>
          )}

          {error && (
            <p style={{ color: '#f66', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </p>
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
