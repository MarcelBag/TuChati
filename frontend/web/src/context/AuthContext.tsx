// src/context/AuthContext.tsx
// ============================================================
// TuChati AuthContext.tsx
// JWT login/logout + auto-refresh + avatar support
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { apiFetch } from '../shared/api'

interface User {
  id?: number
  username?: string
  email?: string
  avatar?: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('access'))
  const [refresh, setRefresh] = useState<string | null>(localStorage.getItem('refresh'))
  const [loading, setLoading] = useState(true)

  // --- Helpers for storage ---
  const saveTokens = useCallback((access: string, refreshToken: string) => {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refreshToken)
    setToken(access)
    setRefresh(refreshToken)
  }, [])

  const clearTokens = useCallback(() => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setToken(null)
    setRefresh(null)
  }, [])

  // --- Refresh token automatically ---
  const refreshAccessToken = useCallback(async () => {
    if (!refresh) return false
    try {
      const res = await apiFetch('/api/accounts/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) return false
      const data = await res.json()
      saveTokens(data.access, refresh)
      return true
    } catch {
      return false
    }
  }, [refresh, saveTokens])

  // --- Load user profile ---
  const loadUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    const res = await apiFetch('/api/accounts/me/', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      const data = await res.json()
      setUser(data)
    } else {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        await loadUser()
      } else {
        clearTokens()
        setUser(null)
      }
    }

    setLoading(false)
  }, [token, refreshAccessToken, clearTokens])

  // --- On mount, load user if token exists ---
  useEffect(() => {
    loadUser()
  }, [loadUser])

  // --- Auto-refresh every 4 min (token lifespan 5 min) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        clearTokens()
        setUser(null)
      }
    }, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshAccessToken, clearTokens])

  // --- LOGIN ---
  async function login(usernameOrEmail: string, password: string) {
    const res = await apiFetch('/api/accounts/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameOrEmail, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || 'Invalid credentials')
    }

    const data = await res.json()
    saveTokens(data.access, data.refresh)
    setUser(data.user)
  }

  // --- LOGOUT ---
  function logout() {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// --- Hook ---
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
