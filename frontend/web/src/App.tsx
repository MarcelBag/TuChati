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

export default function App() {
  const { t } = useTranslation()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <Router>
       {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      <header className="nav">
        <div className="brand">
          <span className="logo">TuChati</span>
        </div>

        <nav className="nav-right" aria-label="Primary">
          <NavLink to="/" className="nav-link">{t('nav.home')}</NavLink>
          <NavLink to="/chatshow" className="nav-link">{t('nav.demo')}</NavLink>
          <NavLink to="/chat" className="nav-link">{t('nav.chat')}</NavLink>
          <NavLink to="/profile" className="nav-link">{t('nav.profile')}</NavLink>

          <button
            className="link-btn"
            type="button"
            onClick={() => setAuthOpen(true)}
          >
            {t('nav.login')}
          </button>

          <DownloadMenu />
          <LanguageSwitcher />
          <ThemeSwitcher />
          
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chatshow" element={<ChatShow />} /> 
          <Route path="/chat" element={<ChatRoom />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      <footer className="footer">
        <small>© {new Date().getFullYear()} TuChati • {t('footer.madeFor')}</small>
      </footer>
    </Router>
  )
}
