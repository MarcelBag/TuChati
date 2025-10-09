// src/shared/LanguageSwitcher.tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

// Available languages
const LANGS = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Kiswahili', flag: '🇹🇿' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ln', name: 'Lingala', flag: '🇨🇩' }
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState(i18n.language || 'fr')
  const ref = useRef<HTMLDivElement>(null)

  // 🧠 Load saved language on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('lang')
      if (savedLang && savedLang !== currentLang) {
        i18n.changeLanguage(savedLang)
        setCurrentLang(savedLang)
      }
    } catch {
      // ignore storage errors (private mode)
    }
  }, [])

  // 🧹 Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🌐 Change language and save
  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng).then(() => {
      setCurrentLang(lng)
      localStorage.setItem('lang', lng)
      setOpen(false)
    })
  }

  const current = LANGS.find(l => l.code === currentLang) || LANGS[0]

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-btn"
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flag">{current.flag}</span>
        <span className="lang-name">{current.name}</span>
        <span className="caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="lang-menu" role="menu">
          {LANGS.filter(l => l.code !== current.code).map(lang => (
            <li key={lang.code}>
              <button
                type="button"
                onClick={() => changeLang(lang.code)}
                className="lang-item"
                role="menuitem"
              >
                <span className="flag">{lang.flag}</span>
                {lang.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
