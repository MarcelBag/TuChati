import React from 'react'
import { createPortal } from 'react-dom'
import ImagePreviewModal from '../../shared/ImagePreviewModal'
import AvatarBubble from '../../shared/AvatarBubble'
import './Reactions.css'

type UserProfile = {
  id: number | string
  uuid?: string
  username: string
  display_name: string
  initials: string
  avatar?: string | null
  bio?: string
  status_message?: string
  current_status?: string
  last_seen?: string | null
  phone?: string | null
  email?: string | null
  is_online?: boolean
  privacy?: Record<string, boolean>
  viewer_is_self?: boolean
}

type Props = {
  open: boolean
  loading: boolean
  profile: UserProfile | null
  error?: string | null
  onClose: () => void
}

export default function UserProfileModal({ open, loading, profile, error = null, onClose }: Props) {
  const [previewOpen, setPreviewOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) setPreviewOpen(false)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const avatarUrl = profile?.avatar || null

  const content = (
    <div className="modal-wrap" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-surface user-profile-modal" onClick={(event) => event.stopPropagation()}>
        {loading && (
          <div className="modal-loading">Loading profile…</div>
        )}

        {!loading && error && (
          <div className="modal-loading error">{error}</div>
        )}

        {!loading && !error && profile && (
          <>
            <header className="user-profile-header">
              <AvatarBubble
                src={avatarUrl}
                name={profile.display_name}
                initials={profile.initials}
                size="lg"
                interactive={!!avatarUrl}
                onClick={() => avatarUrl && setPreviewOpen(true)}
                ariaLabel={`${profile.display_name} avatar`}
              />
              <div>
                <h3>{profile.display_name}</h3>
                <p>@{profile.username}</p>
                <div className={`presence ${profile.is_online ? 'online' : 'offline'}`}>
                  {profile.is_online ? 'Online' : 'Offline'}
                </div>
              </div>
              <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
            </header>

            <div className="user-profile-body">
              {profile.bio && (
                <section>
                  <h4>About</h4>
                  <p>{profile.bio}</p>
                </section>
              )}

              {(profile.status_message || profile.current_status) && (
                <section>
                  <h4>Status</h4>
                  {profile.status_message && <p>{profile.status_message}</p>}
                  {profile.current_status && <p className="dim">{profile.current_status}</p>}
                </section>
              )}

              {profile.last_seen && (
                <section>
                  <h4>Last seen</h4>
                  <p>{new Date(profile.last_seen).toLocaleString()}</p>
                </section>
              )}

              {(profile.email || profile.phone) && (
                <section>
                  <h4>Contact</h4>
                  {profile.email && <p>Email: {profile.email}</p>}
                  {profile.phone && <p>Phone: {profile.phone}</p>}
                </section>
              )}

              {profile.privacy && (
                <section>
                  <h4>Privacy settings</h4>
                  <ul className="privacy-list">
                    {Object.entries(profile.privacy).map(([key, value]) => (
                      <li key={key}>{key.replace('share_', '').replace('_', ' ')}: {value ? 'Shared' : 'Hidden'}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}

        {!loading && !error && !profile && (
          <div className="modal-loading">Profile unavailable.</div>
        )}
      </div>
      <ImagePreviewModal
        open={previewOpen && !!avatarUrl}
        src={avatarUrl}
        alt={`${profile?.display_name || 'User'} avatar`}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )

  return createPortal(content, document.body)
}
