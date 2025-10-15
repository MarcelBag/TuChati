import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type MediaPreference = 'stream' | 'manual'

export type PreferencesState = {
  notificationsEnabled: boolean
  playSendSound: boolean
  playReceiveSound: boolean
  autoDownloadImages: MediaPreference
  autoDownloadVideos: MediaPreference
  autoDownloadAudio: MediaPreference
  shareDeliveryReceipts: boolean
  shareReadReceipts: boolean
}

type PreferencesContextValue = {
  prefs: PreferencesState
  update: (patch: Partial<PreferencesState>) => void
  reset: () => void
}

const DEFAULT_PREFS: PreferencesState = {
  notificationsEnabled: true,
  playSendSound: true,
  playReceiveSound: true,
  autoDownloadImages: 'stream',
  autoDownloadVideos: 'manual',
  autoDownloadAudio: 'manual',
  shareDeliveryReceipts: true,
  shareReadReceipts: true,
}

const STORAGE_KEY = 'tuchati.preferences'

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_PREFS
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_PREFS, ...parsed }
    } catch (error) {
      console.warn('Failed to load preferences, using defaults.', error)
      return DEFAULT_PREFS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch (error) {
      console.warn('Failed to persist preferences', error)
    }
  }, [prefs])

  const update = useCallback((patch: Partial<PreferencesState>) => {
    setPrefs(prev => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS)
  }, [])

  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }
  return ctx
}

export function useMediaPreference(kind: 'images' | 'videos' | 'audio'): MediaPreference {
  const { prefs } = usePreferences()
  switch (kind) {
    case 'videos':
      return prefs.autoDownloadVideos
    case 'audio':
      return prefs.autoDownloadAudio
    default:
      return prefs.autoDownloadImages
  }
}
