import React from 'react'
import { useTranslation } from 'react-i18next'

export type StarredMessage = {
  id?: string | null
  _client_id?: string | null
  created_at?: string | null
  sender_name?: string | null
  text?: string | null
  attachment?: string | null
  is_me?: boolean
  replied_to_id?: string | null
  starred?: boolean
}

type Props = {
  items: StarredMessage[]
  loading: boolean
  error: string | null
  canReply: boolean
  canForward: boolean
  onJump: (message: StarredMessage) => void
  onReply: (message: StarredMessage) => void
  onForward: (message: StarredMessage) => void
  formatTimestamp: (value?: string | null) => string
}

export default function StarredMessageList({ items, loading, error, canReply, canForward, onJump, onReply, onForward, formatTimestamp }: Props) {
  const { t } = useTranslation()

  return (
    <div className="ri-favorites">
      {loading && <p className="ri-loading">{t('chatRoom.profile.favorites.loading')}</p>}
      {error && <p className="ri-error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="ri-empty">{t('chatRoom.profile.favorites.empty')}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="ri-favorites-list">
          {items.map((fav) => {
            const key = String(fav.id ?? fav._client_id ?? Math.random())
            const timeLabel = formatTimestamp(fav.created_at)
            const authorLabel = fav.is_me ? t('chatRoom.profile.you') : (fav.sender_name || t('chatRoom.profile.fallbackName'))
            const preview = (fav.text || '').trim() || t('chatRoom.profile.favorites.attachment')
            return (
              <li key={key} className="ri-fav-item">
                <button
                  type="button"
                  className="ri-fav-btn"
                  onClick={() => onJump(fav)}
                >
                  <div className="ri-fav-meta">
                    <span className="ri-fav-author">{authorLabel}</span>
                    {timeLabel && <span className="ri-fav-time">{timeLabel}</span>}
                  </div>
                  <p className="ri-fav-text">{preview}</p>
                </button>
                <div className="ri-fav-actions">
                  <button
                    type="button"
                    className="ri-fav-action"
                    disabled={!canReply}
                    onClick={() => onReply(fav)}
                  >
                    {t('chatRoom.profile.favorites.reply')}
                  </button>
                  <button
                    type="button"
                    className="ri-fav-action"
                    disabled={!canForward}
                    onClick={() => onForward(fav)}
                  >
                    {t('chatRoom.profile.favorites.forward')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
