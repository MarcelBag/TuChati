// src/shared/AuthModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './auth.css'
import { apiFetch } from './api'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
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
        // Create account using backend our in house backend point 
        //const res = await fetch('/api/accounts/register/', {
        const res = await apiFetch('/api/accounts/register/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            username: email.split('@')[0],
            password,
            password2: confirmPassword || password,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.password) throw new Error('Passwords did not match.')
          if (data.detail) throw new Error(data.detail)
          if (data.email) throw new Error('Email already exists.')
          throw new Error('Registration failed.')
        }
      }

      // Then log in automatically
      await login(email, password)

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
