/* frontend/web/src/features/twofa/VerificationCodeForm.tsx */
import { FormEvent } from 'react'
import './twofa.css'

type Props = {
  code: string
  onChange: (value: string) => void
  onSubmit: () => void
  onResend?: () => void
  loading?: boolean
  error?: string
  info?: string
  countdownLabel?: string
  countdown?: string
  allowResend?: boolean
}

export function VerificationCodeForm({
  code,
  onChange,
  onSubmit,
  onResend,
  loading,
  error,
  info,
  countdownLabel = 'Code expires in',
  countdown,
  allowResend,
}: Props) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!loading) onSubmit()
  }

  const helper = info && !error ? info : null

  return (
    <div className="twofa-shell">
      <div className="twofa-panel">
        <div className="twofa-glow" aria-hidden="true" />
        <div className="twofa-card">
          <div className="twofa-card-head">
            <div className="twofa-badge">Tu</div>
            <div>
              <h3>Check your inbox</h3>
              <p>We sent a 6-digit code to your email address.</p>
            </div>
          </div>

          <form className="twofa-form" onSubmit={handleSubmit}>
            <label htmlFor="twofa-code">Enter your verification code</label>
            <div className="twofa-input-wrap">
              <input
                id="twofa-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => onChange(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                placeholder="123456"
                autoFocus
              />
              <div className="twofa-input-border" aria-hidden="true" />
            </div>

            <div className="twofa-meta">
              {countdown && (
                <span className="twofa-countdown">{countdownLabel}: <strong>{countdown}</strong></span>
              )}
              {helper && <span className="twofa-helper">{helper}</span>}
            </div>

            {error && <p className="twofa-error">{error}</p>}

            <button type="submit" className="twofa-submit" disabled={loading || code.length !== 6}>
              {loading ? 'Checking…' : 'Verify code'}
            </button>

            {onResend && (
              <button
                type="button"
                className="twofa-resend"
                disabled={!allowResend || loading}
                onClick={() => onResend()}
              >
                Resend code
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
