// src/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import fr from './locales/fr.json'
import sw from './locales/sw.json'
import de from './locales/de.json'
import ln from './locales/ln.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      sw: { translation: sw },
      de: { translation: de },
      ln: { translation: ln } 
    },
    lng: localStorage.getItem('lang') || 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    // but fine to leave defaults
  })

export default i18n
