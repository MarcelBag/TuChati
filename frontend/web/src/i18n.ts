// src/i18n.ts

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Language files
import en from './locales/en.json'
import fr from './locales/fr.json'
import sw from './locales/sw.json'
import de from './locales/de.json'
import ln from './locales/ln.json'

// Safe language detection before initialization
let savedLang: string | null = null
try {
  savedLang = localStorage.getItem('lang')
} catch {
  // ignore errors (e.g., server or restricted mode)
}

const browserLang = navigator.language?.split('-')[0] || 'fr'
const defaultLang = savedLang || browserLang || 'fr'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      sw: { translation: sw },
      de: { translation: de },
      ln: { translation: ln },
    },
    // Apply before initialization
    lng: defaultLang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    // Prevent flicker/race in Chrome
    react: { useSuspense: false },
  })

export default i18n
