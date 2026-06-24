import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const fl = {
    fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700,
    letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)',
    marginBottom: 10, display: 'block',
  }
  const fi = {
    width: '100%', padding: '14px 18px', background: 'var(--bg)',
    border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)',
    fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 8,
    boxSizing: 'border-box',
  }
  const btn = {
    fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)',
    border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer',
    width: '100%', marginTop: 24,
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )
    setLoading(false)
    // Always show the confirmation state — don't confirm whether email exists
    if (err && err.message.toLowerCase().includes('rate')) {
      setError('Too many requests. Please wait a few minutes and try again.')
      return
    }
    setSent(true)
  }

  // ── Confirmation state ───────────────────────────────────────────────────
  if (sent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Check your email — unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        <div
          style={{ padding: '40px 0 56px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <Logo />
        </div>

        {/* Icon */}
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 24 }}>✉️</div>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
            Check your email.
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7 }}>
            We sent a reset link to{' '}
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{email}</span>.
            <br />
            Didn't get it? Check your spam folder or{' '}
            <span
              style={{ color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setSent(false)}
            >
              try again
            </span>.
          </div>
        </div>

        <button style={btn} onClick={() => router.push('/login')}>
          Back to log in
        </button>
      </div>
    </div>
  )

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Reset your password — unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        {/* Logo */}
        <div
          style={{ padding: '40px 0 48px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <Logo />
        </div>

        {/* Back */}
        <div
          style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => router.push('/login')}
        >
          ← Back to log in
        </div>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            Forgot your password?
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>
            Enter your email and we'll send you a link to reset it.
          </div>
        </div>

        {error && (
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E',
            background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={fl}>Email address</label>
          <input
            style={fi}
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.5 }}>
            We'll send a link to this address if it's connected to an account.
          </div>
          <button type="submit" style={{ ...btn, opacity: loading ? 0.5 : 1 }} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  )
}
