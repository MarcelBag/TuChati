// src/shared/AuthModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './auth.css'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
// src/shared/AuthModal.tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError('')

  try {
    if (mode === 'signup') {
      // ✅ Use the correct backend endpoint
      const res = await fetch('/api/accounts/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: email.split('@')[0], // derive username from email for now
          password,
          password2: password, // match backend serializer requirement
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(JSON.stringify(data))
      }
    }

    // ✅ Login (token obtain)
    const loginRes = await fetch('/api/accounts/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!loginRes.ok) {
      const data = await loginRes.json()
      throw new Error(data.detail || 'Invalid credentials')
    }

    const tokenData = await loginRes.json()
    localStorage.setItem('token', tokenData.access)
    window.location.href = '/chat' // optional redirect
    onClose()
  } catch (err: any) {
    setError('Authentication failed: ' + (err.message || 'Unknown error'))
  }
}

}
