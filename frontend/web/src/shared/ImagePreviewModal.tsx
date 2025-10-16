// frontend/web/src/shared/ImagePreviewModal.tsx
import React from 'react'
import './imagePreviewModal.css'

type ImagePreviewModalProps = {
  open: boolean
  src?: string | null
  alt?: string
  onClose: () => void
}

export default function ImagePreviewModal({ open, src, alt = 'Image preview', onClose }: ImagePreviewModalProps) {
  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }, [onClose])

  React.useEffect(() => {
    if (!open || !src) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, src, handleKeyDown])

  if (!open || !src) return null

  return (
    <div className="ipm-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="ipm-modal" role="document" onMouseDown={(event) => event.stopPropagation()}>
        <button className="ipm-close" type="button" onClick={onClose} aria-label="Close preview">×</button>
        <img src={src} alt={alt} />
      </div>
    </div>
  )
}
