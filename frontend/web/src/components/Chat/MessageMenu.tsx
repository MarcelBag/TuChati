// frontend/web/src/components/MessageMenu.tsx
import React from 'react'
import './Reactions.css'

export default function MessageMenu({
  open, x, y, mine,
  onClose, onCopy, onForward, onEdit, onDelete,
}: {
  open: boolean; x: number; y: number; mine: boolean
  onClose: () => void
  onCopy: () => void
  onForward: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onClick = () => onClose()
    if (open) {
      window.addEventListener('keydown', onEsc)
      window.addEventListener('click', onClick)
    }
    return () => {
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('click', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ctx-wrap" onClick={onClose}>
      <div
        className="menu ctx"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        <button className="menu-item">Info</button>
        <button className="menu-item" onClick={onForward}>Forward</button>
        <button className="menu-item" onClick={onCopy}>Copy</button>
        {mine && <button className="menu-item">Reply</button>}
        {mine && <button className="menu-item">Pin</button>}
        {mine && <button className="menu-item">Star</button>}
        {mine && <button className="menu-item">Add to notes</button>}
        {mine && <button className="menu-item danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}
