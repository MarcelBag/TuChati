// src/pages/Home.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthModal from '../shared/AuthModal'
import DownloadMenu from '../shared/DownloadMenu'
import './home.css'
import LanguageSwitcher from '../shared/LanguageSwitcher'


export default function Home() {
  const [authOpen, setAuthOpen] = useState(false)
  const { t, i18n } = useTranslation()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div className="home">
      {/* Nav */}
      <header className="nav">
        <div className="brand">
          <span className="logo">TuChati</span>
        </div>
        
        <nav className="nav-right" aria-label="Primary">
        <Link className="nav-link" to="/chat">{t('nav.chat')}</Link>
        <Link className="nav-link" to="/profile">{t('nav.profile')}</Link>
        <button
          className="link-btn"
          type="button"
          onClick={() => setAuthOpen(true)}
          aria-haspopup="dialog"
        >
          {t('nav.login')}
        </button>
        <DownloadMenu />
        <LanguageSwitcher />
      </nav>

      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-copy">
            <h1>{t('hero.title')}</h1>
            <p className="lead">{t('hero.description')}</p>

            <div className="cta">
              <button
                className="cta-primary"
                type="button"
                onClick={() => setAuthOpen(true)}
                aria-haspopup="dialog"
              >
                {t('cta.login')}
              </button>
              <DownloadMenu variant="button" />
            </div>

            <ul className="bullets">
              <li>📶 {t('features.retry')}</li>
              <li>🧵 {t('features.light')}</li>
              <li>📦 {t('features.offline')}</li>
              <li>🔐 {t('features.security')}</li>
            </ul>
          </div>

          <div className="hero-card" aria-label="Data usage savings">
            <div className="stat">
              <span className="stat-num">70%</span>
              <span className="stat-label">{t('hero.saving')}</span>
            </div>
            <div className="divider" />
            <p className="fine">{t('hero.note')}</p>
          </div>
        </section>

        {/* Problem → Solution */}
        <section className="panel">
          <div className="panel-grid">
            <div>
              <h2>{t('section.remote.title')}</h2>
              <p>{t('section.remote.desc')}</p>
              <ul className="checks">
                <li>✅ {t('section.remote.item1')}</li>
                <li>✅ {t('section.remote.item2')}</li>
                <li>✅ {t('section.remote.item3')}</li>
              </ul>
            </div>
            <div>
              <h2>{t('section.org.title')}</h2>
              <p>{t('section.org.desc')}</p>
              <ul className="checks">
                <li>✅ {t('section.org.item1')}</li>
                <li>✅ {t('section.org.item2')}</li>
                <li>✅ {t('section.org.item3')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="cta-footer">
          <h3>{t('cta.title')}</h3>
          <div className="cta">
            <button
              className="cta-primary"
              type="button"
              onClick={() => setAuthOpen(true)}
              aria-haspopup="dialog"
            >
              {t('cta.signup')}
            </button>
            <DownloadMenu variant="button" />
          </div>
        </section>
      </main>

      <footer className="footer">
        <small>© {new Date().getFullYear()} TuChati • {t('footer.madeFor')}</small>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
