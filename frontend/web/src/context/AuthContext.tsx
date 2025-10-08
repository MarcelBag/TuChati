// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

  // Keeping the token in sync & fetch current user when token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
      fetch('/api/accounts/me/', {
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

  // Login using SimpleJWT endpoint
  async function login(email: string, password: string) {
    const res = await fetch('/api/accounts/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) throw new Error('Invalid credentials')

    const data = await res.json()
    setToken(data.access)
  }

  // Loging out clears token + user
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
