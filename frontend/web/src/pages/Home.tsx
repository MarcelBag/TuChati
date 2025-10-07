// src/pages/Home.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthModal from '../shared/AuthModal'
import DownloadMenu from '../shared/DownloadMenu'
import LanguageSwitcher from '../shared/LanguageSwitcher'
import './home.css'

// hero image stored at: /media/images/TuChati.png
import heroImg from '/images/TuChati.png'

export default function Home() {
  const { t } = useTranslation()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="home">
      {/* page tools row under the global header */}

      {/* HERO */}
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">
            {t('hero.title')} <span className="wave" aria-hidden>👋</span>
          </h1>
          <p className="lead">{t('hero.description')}</p>

          <div className="cta">
            <button
              className="btn primary"
              onClick={() => setAuthOpen(true)}
              aria-haspopup="dialog"
            >
              {t('cta.login')}
            </button>
            <DownloadMenu variant="button" />
          </div>

          <ul className="bullets" aria-label="Highlights">
            <li>📶 {t('features.retry')}</li>
            <li>🧵 {t('features.light')}</li>
            <li>📦 {t('features.offline')}</li>
            <li>🔐 {t('features.security')}</li>
          </ul>
        </div>

        <div className="hero-visual">
          <img
            src={heroImg}
            alt="People chatting with TuChati"
            loading="lazy"
            width={640}
            height={420}
          />
          <aside className="stat-card" aria-label="Data usage">
            <div className="stat">
              <span className="stat-num">70%</span>
              <span className="stat-label">{t('hero.saving')}</span>
            </div>
            <p className="note">{t('hero.note')}</p>
          </aside>
        </div>
      </section>

      {/* PANELS */}
      <section className="panels">
        <article className="panel-card">
          <h2>{t('section.remote.title')}</h2>
          <p className="muted">{t('section.remote.desc')}</p>
          <ul className="checks">
            <li>✅ {t('section.remote.item1')}</li>
            <li>✅ {t('section.remote.item2')}</li>
            <li>✅ {t('section.remote.item3')}</li>
          </ul>
        </article>

        <article className="panel-card">
          <h2>{t('section.org.title')}</h2>
          <p className="muted">{t('section.org.desc')}</p>
          <ul className="checks">
            <li>✅ {t('section.org.item1')}</li>
            <li>✅ {t('section.org.item2')}</li>
            <li>✅ {t('section.org.item3')}</li>
          </ul>
        </article>
      </section>

      {/* BOTTOM CTA */}
      <section className="join">
        <h3>{t('cta.title')}</h3>
        <div className="cta">
          <button
            className="btn primary"
            onClick={() => setAuthOpen(true)}
            aria-haspopup="dialog"
          >
            {t('cta.signup')}
          </button>
          <DownloadMenu variant="button" />
        </div>
      </section>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
