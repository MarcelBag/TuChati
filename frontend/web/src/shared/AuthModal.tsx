// src/shared/AuthModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './auth.css'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'signup') {
        await fetch('/api/users/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
      }
      await login(email, password)
      onClose()
    } catch {
      setError('Authentication failed')
    }
  }

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-header">
          <h3>{mode === 'login' ? 'Login' : 'Create account'}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Full name
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          {error && <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>}
          <button className="btn primary" type="submit">
            {mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <button className="link-btn" onClick={() => setMode('signup')}>Need an account? Sign up</button>
          ) : (
            <button className="link-btn" onClick={() => setMode('login')}>Have an account? Login</button>
          )}
        </div>
      </div>
    </div>
  )
}
