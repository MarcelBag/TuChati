// src/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import translation JSONs
import en from './locales/en.json'
import fr from './locales/fr.json'
import sw from './locales/sw.json'
import de from './locales/de.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      sw: { translation: sw },
      de: { translation: de },
    },
    lng: localStorage.getItem('lang') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
