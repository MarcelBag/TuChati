// frontend/web/src/shared/ThemeSwitcher.tsx
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    // default to light
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="theme-toggle"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
