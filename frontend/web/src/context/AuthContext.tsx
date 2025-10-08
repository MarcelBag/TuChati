// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  user: any
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
      fetch('/api/auth/me/', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => setUser(data))
        .catch(() => setUser(null))
    } else {
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [token])

  async function login(email: string, password: string) {
    const res = await fetch('/api/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) throw new Error('Invalid credentials')

    const data = await res.json()
    setToken(data.access)
  }

  function logout() {
    setToken(null)
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
