// src/context/ThemeContext.tsx
import React from 'react'

type Theme = 'light' | 'dark'
type ThemeContextValue = {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

const THEME_KEY = 'tuchati:theme'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null
  if (saved === 'light' || saved === 'dark') return saved
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme)

  const applyTheme = React.useCallback((next: Theme) => {
    const root = document.documentElement
    root.setAttribute('data-theme', next)
    root.classList.toggle('light', next === 'light')
    root.classList.toggle('dark', next === 'dark')
    document.body.classList.toggle('light', next === 'light')
    document.body.classList.toggle('dark', next === 'dark')
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem(THEME_KEY, t)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  React.useEffect(() => {
    applyTheme(theme)
  }, [applyTheme, theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
