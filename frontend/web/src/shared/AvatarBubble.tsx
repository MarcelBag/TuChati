// frontend/web/src/shared/AvatarBubble.tsx
import React from 'react'
import { resolveUrl } from './api'

type Size = 'sm' | 'md' | 'lg'

type BaseProps = {
  src?: string | null
  name?: string | null
  initials?: string | null
  size?: Size
  className?: string
  title?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => void
  tabIndex?: number
  role?: string
  ariaLabel?: string
}

type Props = BaseProps & {
  interactive?: boolean
}

const sizeClass: Record<Size, string> = {
  sm: 'sm',
  md: '',
  lg: 'lg',
}

export default function AvatarBubble({
  src,
  name,
  initials,
  size = 'md',
  className = '',
  interactive = false,
  title,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ariaLabel,
}: Props) {
  const resolvedSrc = src ? resolveUrl(src) : null
  const fallback = (initials || name || 'U').trim().slice(0, 2).toUpperCase()
  const combinedClass = ['avatar-badge', sizeClass[size], resolvedSrc ? 'has-image' : '', className]
    .filter(Boolean)
    .join(' ')

  if (interactive) {
    return (
      <button
        type="button"
        className={combinedClass}
        onClick={onClick as any}
        onKeyDown={onKeyDown as any}
        tabIndex={tabIndex}
        aria-label={ariaLabel || name || 'Profile avatar'}
        title={title || name || undefined}
      >
        {resolvedSrc ? <img src={resolvedSrc} alt={ariaLabel || name || 'Avatar'} /> : fallback}
      </button>
    )
  }

  return (
    <div
      className={combinedClass}
      onClick={onClick as any}
      onKeyDown={onKeyDown as any}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      title={title || name || undefined}
    >
      {resolvedSrc ? <img src={resolvedSrc} alt={ariaLabel || name || 'Avatar'} /> : fallback}
    </div>
  )
}
