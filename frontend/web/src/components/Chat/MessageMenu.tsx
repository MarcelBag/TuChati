import React from 'react'
import './Reactions.css'

export type MessageMenuAction = {
  key: string
  label: string
  onClick: () => void
  danger?: boolean
  icon?: React.ReactNode
  separatorBefore?: boolean
  disabled?: boolean
}

type Props = {
  open: boolean
  x: number
  y: number
  actions: MessageMenuAction[]
  onClose: () => void
}

export default function MessageMenu({ open, x, y, actions, onClose }: Props) {
  React.useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    const handleClick = () => onClose()
    window.addEventListener('keydown', handleKey)
    window.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('click', handleClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ctx-wrap" onClick={onClose}>
      <div
        className="menu ctx message-menu"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        {actions.map(action => (
          <React.Fragment key={action.key}>
            {action.separatorBefore && <div className="menu-separator" />}
            <button
              type="button"
              className={`menu-item ${action.danger ? 'danger' : ''}`}
              onClick={() => {
                if (action.disabled) return
                action.onClick()
                onClose()
              }}
              disabled={action.disabled}
            >
              {action.icon && <span className="menu-icon">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
