// src/shared/DownloadMenu.tsx
import { useState } from 'react'
import './download.css'

type Props = { variant?: 'link' | 'button' }
export default function DownloadMenu({ variant = 'link' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="download">
      <button
        className={variant === 'button' ? 'btn' : 'link-btn'}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Download
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="menu" role="menu">
          {/* Swap these placeholders with your real links */}
          <a role="menuitem" href="/downloads/tuchati-android.apk">Android (APK)</a>
          <a role="menuitem" href="https://play.google.com/store/apps/details?id=com.tuchati" target="_blank" rel="noreferrer">Google Play</a>
          <a role="menuitem" href="https://apps.apple.com/app/idXXXXXXXXX" target="_blank" rel="noreferrer">iOS App Store</a>
          <a role="menuitem" href="/downloads/tuchati-ios-testflight" target="_blank" rel="noreferrer">iOS TestFlight</a>
        </div>
      )}
    </div>
  )
}
