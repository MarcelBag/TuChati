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

  return (
    <form className="twofa-form" onSubmit={handleSubmit}>
      <label htmlFor="twofa-code">Verification code</label>
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

      {countdown && (
        <p className="twofa-countdown">
          {countdownLabel}: <span>{countdown}</span>
        </p>
      )}

      {error && <p className="twofa-error">{error}</p>}
      {info && !error && <p className="twofa-info">{info}</p>}

      <button type="submit" disabled={loading || code.length !== 6}>
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
  )
}
