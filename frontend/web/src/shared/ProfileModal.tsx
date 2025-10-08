// frontend/web/src/shared/ProfileModal.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './profileModal.css'

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [closing, setClosing] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/users/me/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, email }),
      })
      setMessage('Profile updated!')
    } catch {
      setMessage('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 250)
  }

  return (
    <div className="profile-backdrop" onClick={handleClose}>
      <div
        className={`profile-modal ${closing ? 'closing' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="profile-header">
          <h3>Profile Settings</h3>
          <button className="icon-btn" onClick={handleClose}>✕</button>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <div className="avatar-section">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="avatar-large" />
            ) : (
              <div className="avatar-large">
                {user?.name
                  ? user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
                  : 'TU'}
              </div>
            )}
            <button type="button" className="upload-btn">Change</button>
          </div>

          <label>
            Full Name
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>
            Email
            <input value={email} onChange={e => setEmail(e.target.value)} disabled />
          </label>

          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {message && <p className="info">{message}</p>}
        </form>
      </div>
    </div>
  )
}
