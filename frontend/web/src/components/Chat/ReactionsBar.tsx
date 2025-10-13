// frontend/web/src/components/ReactionsBar.tsx
import React from 'react'
import './Reactions.css'

export const REACTION_SET = ['👍','❤️','😂','😮','😢','🙏','🔥','👏','💯','😡']

export default function ReactionsBar({
  x, y, onPick, onClose,
}: {
  x: number; y: number
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onClick = () => onClose()
    window.addEventListener('keydown', onEsc)
    window.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onEsc); window.removeEventListener('click', onClick) }
  }, [onClose])

  return (
    <div className="rxn-wrap">
      <div
        className="rxn-pop"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        {REACTION_SET.map(e => (
          <button key={e} className="rxn-btn" onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </div>
  )
}
