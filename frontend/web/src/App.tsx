// frontend/web/src/App.tsx
import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import { useTranslation } from 'react-i18next'
import DownloadMenu from './shared/DownloadMenu'
import LanguageSwitcher from './shared/LanguageSwitcher'
import AuthModal from './shared/AuthModal'
import './app.css'
import ThemeSwitcher from './shared/ThemeSwitcher'
import ChatShow from './pages/Chatshow'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProfileModal from './shared/ProfileModal'

import ChatPage from './pages/ChatPage'

/* -------------------------
   NAVBAR COMPONENT
------------------------- */
function NavBar({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { t } = useTranslation()
  const { user, token, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    return parts.map(p => p[0]?.toUpperCase()).slice(0, 2).join('')
  }

  return (
    <>
      <header className="nav">
        <div className="brand">
          <span className="logo">TuChati</span>
        </div>

        <nav className="nav-right" aria-label="Primary">
          {/* Navigation Links */}
          {!token && (
            <>
              <NavLink to="/" className="nav-link">{t('nav.home')}</NavLink>
              <NavLink to="/chatshow" className="nav-link">{t('nav.demo')}</NavLink>
              <NavLink to="/chat" className="nav-link">{t('nav.chat')}</NavLink>
              <NavLink to="/profile" className="nav-link">{t('nav.profile')}</NavLink>
            </>
          )}

          {token && (
            <NavLink to="/chat" className="nav-link">{t('nav.chat')}</NavLink>
          )}

          {/* Login / Logout */}
          {!token ? (
            <button className="link-btn" type="button" onClick={onOpenAuth}>
              {t('nav.login')}
            </button>
          ) : (
            <button className="link-btn" type="button" onClick={logout}>
              {t('nav.logout')}
            </button>
          )}

          {/* Show Download only if NOT logged in */}
          {!token && <DownloadMenu />}

          <LanguageSwitcher />

          {/* Avatar or Theme Switcher */}
          {token ? (
            user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username || 'User'}
                className="avatar"
                onClick={() => setProfileOpen(true)}
              />
            ) : (
              <div
                className="avatar-initials"
                onClick={() => setProfileOpen(true)}
                style={{
                  background: '#4a90e2',
                  color: 'white',
                  fontWeight: '600',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {getInitials(user?.username || 'TU')}
              </div>
            )
          ) : (
            <ThemeSwitcher />
          )}
        </nav>
      </header>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}

/* -------------------------
   MAIN APP CONTENT
------------------------- */
function AppContent() {
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      <NavBar onOpenAuth={() => setAuthOpen(true)} />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chatshow" element={<ChatShow />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:roomId" element={<ChatRoom />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      <footer className="footer">
        <small>© {new Date().getFullYear()} TuChati • Made for Africa</small>
      </footer>
    </>
  )
}

/* -------------------------
   ROOT APP EXPORT
------------------------- */
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}
