// src/shared/LanguageSwitcher.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

const LANGS = [
 { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en')

  // Load saved language on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('lang')
    if (savedLang && savedLang !== currentLang) {
      i18n.changeLanguage(savedLang)
      setCurrentLang(savedLang)
    }
  }, [])

  // Handle change
  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng).then(() => {
      setCurrentLang(lng)
      localStorage.setItem('lang', lng)
      setOpen(false)
    })
  }

  const current = LANGS.find((l) => l.code === currentLang) || LANGS[0]

  return (
    <div className="lang-switcher" onBlur={() => setOpen(false)} tabIndex={0}>
      <button
        className="lang-btn"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="flag">{current.flag}</span>
        <span className="lang-name">{current.name}</span>
        <span className="caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="lang-menu">
          {LANGS.filter((l) => l.code !== current.code).map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                onClick={() => changeLang(lang.code)}
                className="lang-item"
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
