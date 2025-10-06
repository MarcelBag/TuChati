// src/pages/Home.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthModal from '../shared/AuthModal'
import DownloadMenu from '../shared/DownloadMenu'

import './home.css'

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="home">
      {/* Nav */}
      <header className="nav">
        <div className="brand">
          <span className="logo">TuChati</span>
        </div>
        <nav className="nav-right" aria-label="Primary">
          <Link className="nav-link" to="/chat">Chat</Link>
          <Link className="nav-link" to="/profile">Profile</Link>
          <button className="link-btn" type="button" onClick={() => setAuthOpen(true)} aria-haspopup="dialog">
            Login
          </button>
          <DownloadMenu />
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-copy">
            <h1>Messaging that works where internet doesn’t</h1>
            <p className="lead">
              TuChati is built for communities with <b>limited or patchy connectivity</b>.
              It’s lightweight, resilient, and designed to deliver messages on
              low-bandwidth networks without draining data or battery.
            </p>

            <div className="cta">
              <button className="cta-primary" type="button" onClick={() => setAuthOpen(true)} aria-haspopup="dialog">
                Login / Sign up
              </button>
              <DownloadMenu variant="button" />
            </div>

            <ul className="bullets">
              <li>📶 Auto-retry delivery on poor connections</li>
              <li>🧵 Small payloads & text-first by default</li>
              <li>📦 Works with intermittent connectivity (store-and-forward)</li>
              <li>🔐 Account security with modern best practices</li>
            </ul>
          </div>

          <div className="hero-card" aria-label="Data usage savings">
            <div className="stat">
              <span className="stat-num">70%</span>
              <span className="stat-label">smaller data use vs. images-first apps*</span>
            </div>
            <div className="divider" />
            <p className="fine">
              *Optimized request sizes, deferred media, and adaptive retries help keep usage low.
            </p>
          </div>
        </section>

        {/* Problem → Solution */}
        <section className="panel">
          <div className="panel-grid">
            <div>
              <h2>Built for remote areas</h2>
              <p>
                Many messaging apps assume stable 4G/5G. TuChati doesn’t.
                We prioritize reliability and clarity over heavy media and background chatter.
              </p>
              <ul className="checks">
                <li>✅ Messages queue offline and send when signal returns</li>
                <li>✅ Typing, delivery & read states optimized for low overhead</li>
                <li>✅ Media sending is optional and bandwidth-aware</li>
              </ul>
            </div>
            <div>
              <h2>Simple for organizations</h2>
              <p>
                Whether you’re coordinating field teams, health workers, or classrooms,
                TuChati keeps conversations moving with minimal data.
              </p>
              <ul className="checks">
                <li>✅ Clean, focused channels</li>
                <li>✅ Admin tooling via Django</li>
                <li>✅ Friendly APIs for integrations</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="cta-footer">
          <h3>Ready to try TuChati?</h3>
          <div className="cta">
            <button className="cta-primary" type="button" onClick={() => setAuthOpen(true)} aria-haspopup="dialog">
              Create an account
            </button>
            <DownloadMenu variant="button" />
          </div>
        </section>
      </main>

      <footer className="footer">
        <small>© {new Date().getFullYear()} TuChati • Made for low-bandwidth communities</small>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
