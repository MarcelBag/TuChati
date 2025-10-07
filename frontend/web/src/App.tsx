import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import { useTranslation } from 'react-i18next'
import './app.css'

export default function App() {
  const { t } = useTranslation()

  return (
    <Router>
      <header className="shell">
        <div className="shell-inner">
          <div className="brand">
            <img src="/images/TuChati.png" alt="TuChati" className="brand-logo" />
            <span className="brand-name">TuChati</span>
          </div>

          <nav className="nav" aria-label="Primary">
            <NavLink to="/" className="nav-link">{t('nav.home')}</NavLink>
            <NavLink to="/chat" className="nav-link">{t('nav.chat')}</NavLink>
            <NavLink to="/profile" className="nav-link">{t('nav.profile')}</NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<ChatRoom />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} TuChati — {t('footer.madeFor')}</p>
      </footer>
    </Router>
  )
}
