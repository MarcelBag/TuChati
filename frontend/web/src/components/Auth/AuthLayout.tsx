//frontend/web/src/components/AuthLayout.tsx
// frontend/web/src/pages/auth/AuthLayout.tsx
import React from 'react'
import './auth-layout.css'

interface AuthLayoutProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <img src="/images/TuChati.png" alt="TuChati Logo" className="auth-logo" />
        <h1>{title || 'Welcome to TuChati'}</h1>
        <p className="auth-subtitle">
          {subtitle || 'Connect, chat, and share with communities across Africa — even with low internet.'}
        </p>
        <div className="auth-content">
          {children}
        </div>
        <footer className="auth-footer">
          <small>© {new Date().getFullYear()} TuChati • Made for Africa</small>
        </footer>
      </div>
    </div>
  )
}
