// src/shared/AuthModal.tsx
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthModal.css'
import {
  completePasswordReset,
  completeSignup,
  startPasswordReset,
  startSignupVerification,
  verifyPasswordReset,
  verifySignupCode,
} from '../features/twofa/api'
import { VerificationCodeForm } from '../features/twofa/VerificationCodeForm'
import { useCountdown } from '../features/twofa/useCountdown'

type Mode =
  | 'login'
  | 'signup-start'
  | 'signup-verify'
  | 'signup-password'
  | 'reset-request'
  | 'reset-verify'
  | 'reset-password'
  | 'reset-success'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('login')

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // Signup state
  const [signupUsername, setSignupUsername] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupVerificationId, setSignupVerificationId] = useState('')
  const [signupCode, setSignupCode] = useState('')
  const [signupTimer, setSignupTimer] = useState(0)
  const [signupTimerKey, setSignupTimerKey] = useState(0)
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [showSignupPwd, setShowSignupPwd] = useState(false)
  const [showSignupPwd2, setShowSignupPwd2] = useState(false)

  // Password reset state
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetVerificationId, setResetVerificationId] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetTimer, setResetTimer] = useState(0)
  const [resetTimerKey, setResetTimerKey] = useState(0)
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [showResetPwd2, setShowResetPwd2] = useState(false)

  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const signupCountdown = useCountdown(signupTimer, mode === 'signup-verify', signupTimerKey)
  const resetCountdown = useCountdown(resetTimer, mode === 'reset-verify', resetTimerKey)

  const resetNotices = () => {
    setError('')
    setInfo('')
    setLoading(false)
  }

  const resetSignupFlow = () => {
    setSignupVerificationId('')
    setSignupCode('')
    setSignupTimer(0)
    setSignupTimerKey((k) => k + 1)
    setSignupPassword('')
    setSignupConfirmPassword('')
    setShowSignupPwd(false)
    setShowSignupPwd2(false)
  }

  const resetPasswordFlow = () => {
    setResetVerificationId('')
    setResetCode('')
    setResetTimer(0)
    setResetTimerKey((k) => k + 1)
    setResetPassword('')
    setResetPasswordConfirm('')
    setShowResetPwd(false)
    setShowResetPwd2(false)
  }

  const switchMode = (next: Mode) => {
    resetNotices()
    setMode(next)

    if (next === 'login') {
      setPassword('')
      setShowPwd(false)
    }

    if (next === 'signup-start') {
      resetSignupFlow()
    }

    if (next === 'reset-request') {
      resetPasswordFlow()
      setResetIdentifier(loginIdentifier || resetIdentifier)
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)

    try {
      await login(loginIdentifier, password)
      onClose()
      navigate('/chat')
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignupStart(e: FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)
    try {
      const data = await startSignupVerification({ email: signupEmail, username: signupUsername })
      if (!data?.verification_id) {
        setInfo(data?.detail || 'Verification email sent. Check your inbox.')
        return
      }
      setSignupVerificationId(data.verification_id)
      setSignupTimer(data.expires_in || 60)
      setSignupTimerKey((k) => k + 1)
      setSignupCode('')
      setInfo(data.detail || 'We sent a code to your email. Enter it below.')
      setMode('signup-verify')
    } catch (err: any) {
      setError(err.message || 'Unable to send verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignupVerify() {
    if (!signupVerificationId || signupCode.length !== 6) return
    resetNotices()
    setLoading(true)
    try {
      const data = await verifySignupCode({ verification_id: signupVerificationId, code: signupCode })
      setInfo(data.detail || 'Email verified! Choose a password to finish.')
      setSignupTimer(data.expires_in || 300)
      setSignupTimerKey((k) => k + 1)
      setMode('signup-password')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function resendSignupCode() {
    if (!signupEmail || !signupUsername) return
    resetNotices()
    setLoading(true)
    try {
      const data = await startSignupVerification({ email: signupEmail, username: signupUsername })
      if (data?.verification_id) setSignupVerificationId(data.verification_id)
      setSignupTimer(data.expires_in || 60)
      setSignupTimerKey((k) => k + 1)
      setSignupCode('')
      setInfo(data.detail || 'We sent a new code. Check your email.')
    } catch (err: any) {
      setError(err.message || 'Unable to resend code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignupPassword(e: FormEvent) {
    e.preventDefault()
    resetNotices()

    if (!signupVerificationId) {
      setError('Verification has expired. Please request a new code.')
      return
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await completeSignup({
        verification_id: signupVerificationId,
        code: signupCode,
        password: signupPassword,
      })
      await login(signupEmail || signupUsername, signupPassword)
      onClose()
      navigate('/chat')
    } catch (err: any) {
      setError(err.message || 'Unable to finish signup.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault()
    resetNotices()
    setLoading(true)
    try {
      const data = await startPasswordReset(resetIdentifier)
      if (!data?.verification_id) {
        setInfo(data?.detail || 'If that account exists, we sent reset instructions.')
        return
      }
      setResetVerificationId(data.verification_id)
      setResetTimer(data.expires_in || 60)
      setResetTimerKey((k) => k + 1)
      setResetCode('')
      setInfo(data.detail || 'Enter the verification code we just emailed you.')
      setMode('reset-verify')
    } catch (err: any) {
      setError(err.message || 'Could not start password reset.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetVerify() {
    if (!resetVerificationId || resetCode.length !== 6) return
    resetNotices()
    setLoading(true)
    try {
      const data = await verifyPasswordReset({ verification_id: resetVerificationId, code: resetCode })
      setResetTimer(data.expires_in || 300)
      setResetTimerKey((k) => k + 1)
      setInfo(data.detail || 'Code accepted. Choose a new password.')
      setMode('reset-password')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function resendResetCode() {
    if (!resetIdentifier) return
    resetNotices()
    setLoading(true)
    try {
      const data = await startPasswordReset(resetIdentifier)
      if (data?.verification_id) setResetVerificationId(data.verification_id)
      setResetTimer(data.expires_in || 60)
      setResetTimerKey((k) => k + 1)
      setResetCode('')
      setInfo(data.detail || 'We sent a new reset code.')
    } catch (err: any) {
      setError(err.message || 'Unable to resend code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    resetNotices()

    if (!resetVerificationId) {
      setError('Verification expired. Request a new reset code.')
      return
    }

    if (resetPassword !== resetPasswordConfirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await completePasswordReset({
        verification_id: resetVerificationId,
        code: resetCode,
        password: resetPassword,
      })
      setInfo('Password updated! You can log in with your new password now.')
      setLoginIdentifier(resetIdentifier || loginIdentifier)
      setMode('reset-success')
    } catch (err: any) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  const titleMap: Record<Mode, string> = {
    login: 'Login',
    'signup-start': 'Create account',
    'signup-verify': 'Verify your email',
    'signup-password': 'Secure your account',
    'reset-request': 'Forgot password',
    'reset-verify': 'Check your email',
    'reset-password': 'Set a new password',
    'reset-success': 'Password updated',
  }

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-header">
          <h3>{titleMap[mode]}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Username or Email
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                placeholder="your username or email"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <div className="pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  title={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </button>

            <div className="auth-links">
              <button type="button" className="link-btn" onClick={() => switchMode('reset-request')}>
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === 'signup-start' && (
          <form className="auth-form" onSubmit={handleSignupStart}>
            <label>
              Username
              <input
                type="text"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                required
                placeholder="choose a username"
                autoComplete="username"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                placeholder="you@tuunganes.com"
                autoComplete="email"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && !error && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>
        )}

        {mode === 'signup-verify' && (
          <VerificationCodeForm
            code={signupCode}
            onChange={setSignupCode}
            onSubmit={handleSignupVerify}
            onResend={resendSignupCode}
            loading={loading}
            error={error}
            info={info}
            countdown={signupTimer > 0 ? signupCountdown.formatted : undefined}
            allowResend={signupCountdown.isExpired}
          />
        )}

        {mode === 'signup-password' && (
          <form className="auth-form" onSubmit={handleSignupPassword}>
            <p className="auth-info small">
              Email confirmed for <strong>{signupEmail}</strong>. Create a strong password to finish setting up your TuChati account.
            </p>

            <label>
              Password
              <div className="pwd-wrap">
                <input
                  type={showSignupPwd ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowSignupPwd((v) => !v)}
                  aria-label={showSignupPwd ? 'Hide password' : 'Show password'}
                  title={showSignupPwd ? 'Hide password' : 'Show password'}
                >
                  {showSignupPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            <label>
              Confirm password
              <div className="pwd-wrap">
                <input
                  type={showSignupPwd2 ? 'text' : 'password'}
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowSignupPwd2((v) => !v)}
                  aria-label={showSignupPwd2 ? 'Hide password' : 'Show password'}
                  title={showSignupPwd2 ? 'Hide password' : 'Show password'}
                >
                  {showSignupPwd2 ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && !error && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Finish signup'}
            </button>
          </form>
        )}

        {mode === 'reset-request' && (
          <form className="auth-form" onSubmit={handleResetRequest}>
            <p className="auth-info small">
              Enter the email or username linked to your TuChati account. We’ll email a verification code that stays valid for one minute.
            </p>
            <label>
              Email or Username
              <input
                type="text"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && !error && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>
        )}

        {mode === 'reset-verify' && (
          <VerificationCodeForm
            code={resetCode}
            onChange={setResetCode}
            onSubmit={handleResetVerify}
            onResend={resendResetCode}
            loading={loading}
            error={error}
            info={info}
            countdown={resetTimer > 0 ? resetCountdown.formatted : undefined}
            allowResend={resetCountdown.isExpired}
            countdownLabel="Reset code expires in"
          />
        )}

        {mode === 'reset-password' && (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <p className="auth-info small">
              Verification confirmed. Set a new password for <strong>{resetIdentifier}</strong>.
            </p>
            <label>
              New password
              <div className="pwd-wrap">
                <input
                  type={showResetPwd ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowResetPwd((v) => !v)}
                  aria-label={showResetPwd ? 'Hide password' : 'Show password'}
                  title={showResetPwd ? 'Hide password' : 'Show password'}
                >
                  {showResetPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            <label>
              Confirm new password
              <div className="pwd-wrap">
                <input
                  type={showResetPwd2 ? 'text' : 'password'}
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowResetPwd2((v) => !v)}
                  aria-label={showResetPwd2 ? 'Hide password' : 'Show password'}
                  title={showResetPwd2 ? 'Hide password' : 'Show password'}
                >
                  {showResetPwd2 ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && !error && <p className="auth-info">{info}</p>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        )}

        {mode === 'reset-success' && (
          <div className="auth-form">
            {info && <p className="auth-info">{info}</p>}
            <button className="btn primary" type="button" onClick={() => switchMode('login')}>
              Back to login
            </button>
          </div>
        )}

        <div className="auth-switch">
          {mode === 'login' && (
            <button className="link-btn" onClick={() => switchMode('signup-start')}>
              Need an account? Sign up
            </button>
          )}

          {(mode === 'signup-start' || mode === 'signup-verify' || mode === 'signup-password') && (
            <button className="link-btn" onClick={() => switchMode('login')}>
              Have an account? Login
            </button>
          )}

          {(mode === 'reset-request' || mode === 'reset-verify' || mode === 'reset-password') && (
            <button className="link-btn" onClick={() => switchMode('login')}>
              Back to login
            </button>
          )}

          {mode === 'reset-verify' && (
            <button className="link-btn" onClick={() => switchMode('reset-request')}>
              Need a new code?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
