import { useState } from 'react'
import { useRouter } from 'next/router'
import { signIn, resendConfirmation } from '../lib/auth'
import Logo from '../components/Logo'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setUnconfirmed(false); setLoading(true)
    const { data, error: err } = await signIn({ email, password })
    setLoading(false)
    if (err) {
      if (err.message?.toLowerCase().includes('confirm')) setUnconfirmed(true)
      else setError('Incorrect email or password.')
      return
    }
    if (data?.session) router.push('/')
  }

  async function handleResend() {
    await resendConfirmation(email)
    setResent(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <title>Log in — unscripted</title>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 28px' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32, textAlign: 'center' }}>Welcome back.</div>

        {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', marginBottom: 16 }}>{error}</div>}

        {unconfirmed ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 20 }}>Your email isn't confirmed yet. Check your inbox for the confirmation link.</div>
            <button style={btn} onClick={handleResend} disabled={resent}>{resent ? 'Email sent' : 'Resend confirmation email'}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={fl}>Email</label>
            <input style={fi} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
            <label style={fl}>Password</label>
            <input style={fi} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
            <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>Don't have an account? </span>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/signup')}>Sign up</span>
        </div>
      </div>
    </div>
  )
}
