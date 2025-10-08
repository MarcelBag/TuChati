// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiFetch } from '../shared/api'

interface User {
  id?: number
  name?: string
  email?: string
  avatar?: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  // 🔄 Keep token in sync and load user when token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)

      apiFetch('/api/accounts/me/', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => setUser(data))
        .catch(() => setUser(null))
    } else {
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [token])

  // 🔐 Login using SimpleJWT endpoint
  async function login(email: string, password: string) {
    const res = await apiFetch('/api/accounts/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || 'Invalid credentials')
    }

    const data = await res.json()
    setToken(data.access)
  }

  // 🚪 Logout clears token + user
  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
