// frontend/web/src/App.tsx
import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import ChatPage from './pages/ChatPage'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import ChatShow from './pages/Chatshow'

import { useTranslation } from 'react-i18next'
import './app.css'

import DownloadMenu from './shared/DownloadMenu'
import LanguageSwitcher from './shared/LanguageSwitcher'
import ThemeSwitcher from './shared/ThemeSwitcher'
import AuthModal from './shared/AuthModal'
import ProfileModal from './shared/ProfileModal'

import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import { getInitials } from './shared/utils'

import InviteUsersInRoom from './pages/InviteUsersInRoom'
/* -------------------------
   NAVBAR
------------------------- */
function NavBar({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { t } = useTranslation()
  const { user, token } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <>
      <header className="nav">
        <div className="brand">
          <span className="logo">TuChati</span>
        </div>

        <nav className="nav-right" aria-label="Primary">
          {!token && (
            <>
              <NavLink to="/" className="nav-link">{t('nav.home')}</NavLink>
              <NavLink to="/chatshow" className="nav-link">{t('nav.demo')}</NavLink>
              <button className="link-btn" type="button" onClick={onOpenAuth}>
                {t('nav.login')}
              </button>
              <DownloadMenu />
              <LanguageSwitcher />
              <ThemeSwitcher />
            </>
          )}

          {token && (
            <>
              <NavLink to="/" className="nav-link">{t('nav.home')}</NavLink>
              <NavLink to="/chat" className="nav-link">{t('nav.chat')}</NavLink>
              <LanguageSwitcher />
              {user?.avatar ? (
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
                  title={user?.username || 'Profile'}
                >
                  {getInitials(user?.first_name, user?.last_name, user?.username)}
                </div>
              )}
            </>
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
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/chatshow" element={<ChatShow />} />

          {/* Private (gated) */}
          <Route element={<ProtectedRoute />}>
            {/* NEST the room route so the sidebar stays */}
            <Route path="/chat" element={<ChatPage />}>
              <Route path=":roomId" element={<ChatRoom />} />
            </Route>
            
            <Route path="/profile" element={<Profile />} />
            {/* invite user to the room route*/}
            <Route path="/chat/:roomId/invite" element={<InviteUsersInRoom />} />
          </Route>
        </Routes>
      </main>

      <footer className="footer">
        <small>© {new Date().getFullYear()} TuChati • Made for Africa</small>
      </footer>
    </>
  )
}

/* -------------------------
   ROOT APP
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
