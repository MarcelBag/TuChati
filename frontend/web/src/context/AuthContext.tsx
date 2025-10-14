// src/context/AuthContext.tsx
// ============================================================
// TuChati AuthContext
// Single-flight token handling via shared/api, no polling,
// one-time /me load, and tab sync.
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react'
import { apiFetch, loadTokensFromStorage, setTokens } from '../shared/api'

type User = {
  id: number
  username?: string
  email?: string
  name?: string
  avatar?: string | null
} | null

type AuthContextType = {
  user: User
  token: string | null
  loading: boolean
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load tokens once on mount and attempt to fetch /me
  useEffect(() => {
    loadTokensFromStorage()
    const access = localStorage.getItem('access')
    const refresh = localStorage.getItem('refresh')

    if (!access || !refresh) {
      // not logged in
      setUser(null)
      setToken(null)
      setLoading(false)
      return
    }

    setToken(access)

    // Single /me call; apiFetch will refresh if needed
    ;(async () => {
      const res = await apiFetch('/api/accounts/me/')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        // refresh failed upstream -> tokens cleared there; reflect here
        setUser(null)
        setToken(null)
      }
      setLoading(false)
    })()
  }, [])

  // Keep multiple tabs in sync (login/logout elsewhere)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'access' && e.key !== 'refresh') return
      const access = localStorage.getItem('access')
      const refresh = localStorage.getItem('refresh')

      if (!access || !refresh) {
        // logged out in another tab
        setUser(null)
        setToken(null)
        return
      }

      // logged in / refreshed in another tab
      setToken(access)
      ;(async () => {
        const r = await apiFetch('/api/accounts/me/')
        if (r.ok) setUser(await r.json())
      })()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // --- LOGIN ---
  const login = useMemo(
    () => async (usernameOrEmail: string, password: string) => {
      // Public call; do not attach auth header
      const res = await apiFetch('/api/accounts/token/', {
        method: 'POST',
        skipAuth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || 'Invalid credentials')
      }
      const data = await res.json()
      const access = data.access || data.token || data.access_token
      const refresh = data.refresh
      if (!access || !refresh) throw new Error('Malformed auth response')

      // Persist + reflect in state
      setTokens(access, refresh)
      setToken(access)

      // Get user profile (apiFetch handles refresh from now on)
      const meRes = await apiFetch('/api/accounts/me/')
      if (meRes.ok) setUser(await meRes.json())
      else setUser(null)
    },
    []
  )

  // --- LOGOUT ---
  const logout = useMemo(
    () => () => {
      setTokens(null, null) // clears localStorage too
      setUser(null)
      setToken(null)
    },
    []
  )

  const value = useMemo<AuthContextType>(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
