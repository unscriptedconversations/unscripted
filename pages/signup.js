import { useState } from 'react'
import { useRouter } from 'next/router'
import { signUp, resendConfirmation } from '../lib/auth'
import Logo from '../components/Logo'

const COLORS = ['#8B6E52', '#5E7A62', '#C27A5A', '#6B6590', '#52708B', '#7A5278', '#8B7E52', '#8B5E5E', '#8B6E6E']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signup() {
  const router = useRouter()
  const [mode, setMode] = useState(null)
  const [regData, setRD] = useState({ first: '', last: '', email: '', password: '' })
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState('')
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [resent, setResent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim() || !regData.password) {
      setError('All fields are required.'); return
    }
    if (!EMAIL_RE.test(regData.email.trim())) {
      setError('Enter a valid email address.'); return
    }
    if (regData.password.length < 6) {
      setError('Password must be at least 6 characters.'); return
    }
    setSubmitting(true)
    const { error: err } = await signUp({
      email: regData.email, password: regData.password,
      firstName: regData.first, lastName: regData.last, color,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message?.toLowerCase().includes('already') ? 'An account with this email already exists. Try logging in instead.' : err.message)
      return
    }
    try { window.localStorage?.setItem?.('unscripted_intent', mode === 'club' ? 'host' : 'individual') } catch (e) {}
    setAwaitingConfirm(true)
  }

  if (awaitingConfirm) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <title>Check your email — unscripted</title>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 28px' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Check your inbox.</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 28 }}>
          We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{regData.email}</strong>. Click it to activate your account.
          {mode === 'club' && ' You\'ll be taken straight into starting your club.'}
        </div>
        <button style={btn} disabled={resent} onClick={async () => { await resendConfirmation(regData.email); setResent(true) }}>{resent ? 'Email sent' : 'Resend confirmation email'}</button>
        <div style={{ marginTop: 20 }}>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/login')}>Already confirmed? Log in →</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Join unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>

        {!mode && <div style={{ paddingBottom: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 36, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>How do you want<br />to <em style={{ fontStyle: 'italic', color: 'var(--tc)' }}>read?</em></div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)' }}>Join as a reader or start your own book club.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }} onClick={() => setMode('individual')}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 12 }}>Reader</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Join as an individual</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Create your profile and browse book clubs to join.</div>
            </div>
            <div style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }} onClick={() => setMode('club')}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sg)', marginBottom: 12 }}>Host</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Start a book club</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Confirm your account, then set up your club right after.</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>Already have an account? </span>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/login')}>Log in</span>
          </div>
        </div>}

        {mode && <div style={{ paddingBottom: 80 }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Tell us about yourself.</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 32 }}>Just the basics — you can customize the rest later.</div>
          {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label style={fl}>First Name</label><input style={fi} placeholder="First name" value={regData.first} onChange={e => setRD(d => ({ ...d, first: e.target.value }))} />
            <label style={fl}>Last Name</label><input style={fi} placeholder="Last name" value={regData.last} onChange={e => setRD(d => ({ ...d, last: e.target.value }))} />
            <label style={fl}>Email</label><input style={fi} type="email" placeholder="you@email.com" value={regData.email} onChange={e => setRD(d => ({ ...d, email: e.target.value }))} />
            <label style={fl}>Password</label><input style={fi} type="password" placeholder="Create a password" value={regData.password} onChange={e => setRD(d => ({ ...d, password: e.target.value }))} />

            <label style={fl}>Your color</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: color === c ? '0 0 0 2px var(--bg)' : 'none' }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#FFF', fontFamily: 'var(--ui)' }}>{((regData.first[0] || '') + (regData.last[0] || '')).toUpperCase() || '?'}</div>
              <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>This is how you'll appear across unscripted</span>
            </div>

            <button style={{ ...btn, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>{submitting ? 'Creating account...' : 'Create account'}</button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }} onClick={() => setMode(null)}>← Back</span>
          </div>
        </div>}
      </div>
    </div>
  )
}
