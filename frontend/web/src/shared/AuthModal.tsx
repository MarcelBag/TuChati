// src/shared/AuthModal.tsx
import { useState } from 'react'
import './auth.css'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="auth-header">
          <h3>{mode === 'login' ? 'Login' : 'Create account'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="auth-form" onSubmit={(e) => { e.preventDefault(); /* call your API */ }}>
          {mode === 'signup' && (
            <label>
              Full name
              <input required placeholder="Jane Doe" />
            </label>
          )}
          <label>
            Email
            <input type="email" required placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" required placeholder="••••••••" />
          </label>
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
