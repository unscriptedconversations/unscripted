import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { isWeakPassword, weakPasswordText } from '../lib/passwordRules'

// Where the "Reset your password" email lands (pages/forgot-password.js sends
// it with redirectTo /reset-password). Supabase signs the person in from the
// link (#access_token…&type=recovery, or ?code= for the PKCE flow); this page
// then lets them choose a new password.
//
// Only a recovery link unlocks the form: a signed-in visitor who just types
// /reset-password is sent to Account settings, where the current password is
// required.

// supabase-js reads and clears the #hash as soon as the client loads,
// so grab it at module load, before that happens.
const ARRIVAL_HASH = typeof window !== 'undefined' ? window.location.hash : ''
const ARRIVAL_SEARCH = typeof window !== 'undefined' ? window.location.search : ''

function arrival() {
  const h = new URLSearchParams(ARRIVAL_HASH.replace(/^#/, ''))
  const q = new URLSearchParams(ARRIVAL_SEARCH)
  return {
    error: h.get('error_code') || h.get('error') || q.get('error_code') || q.get('error') || '',
    recovery: h.get('type') === 'recovery' || q.get('type') === 'recovery',
    code: q.get('code') || '',
  }
}

function Shell({ children, onLogo }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Choose a new password — unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px 48px' }}>
        <div
          style={{ padding: '40px 0 48px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
          onClick={onLogo}
        >
          <Logo />
        </div>
        {children}
      </div>
    </div>
  )
}

export default function ResetPassword() {
  const router = useRouter()
  const [stage, setStage] = useState('checking') // checking | ready | invalid | signedin | done
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    let cancelled = false
    let recoveryEvent = false
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY' && s) {
        recoveryEvent = true
        if (!cancelled) { setUserId(s.user.id); setStage('ready') }
      }
    })

    async function check() {
      const a = arrival()
      if (a.error) { setStage('invalid'); return }
      let { data: { session } } = await supabase.auth.getSession()
      // PKCE fallback: exchange a ?code= ourselves if it hasn't been picked up yet
      if (!session && a.code) {
        try {
          const { data } = await supabase.auth.exchangeCodeForSession(a.code)
          session = data?.session || null
        } catch (e) { /* handled below */ }
      }
      if (cancelled) return
      if (session && (a.recovery || a.code || recoveryEvent)) {
        setUserId(session.user.id); setStage('ready'); return
      }
      if (session) { setUserId(session.user.id); setStage('signedin'); return }
      setStage('invalid')
    }
    check()
    return () => { cancelled = true; sub?.subscription?.unsubscribe() }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Your new password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords don’t match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password, data: { has_password: true } })
    setLoading(false)
    if (err) {
      if (isWeakPassword(err)) setError(weakPasswordText(err, password))
      else if (err.code === 'same_password') setError('Your new password needs to be different from your old one.')
      else if (err.code === 'over_request_rate_limit' || (err.message || '').toLowerCase().includes('rate limit')) setError('Too many tries in a short time. Please wait a few minutes and try again.')
      else if (err.status === 401 || err.code === 'session_not_found' || err.code === 'bad_jwt') { setStage('invalid'); return }
      else setError(`Something went wrong. Please try again.${err.code ? ` (Error code: ${err.code})` : ''}`)
      return
    }
    setPassword(''); setConfirm('')
    setStage('done')
  }

  const fl = {
    fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700,
    letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)',
    marginBottom: 10, display: 'block',
  }
  const fi = {
    width: '100%', padding: '14px 18px', background: 'var(--bg)',
    border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)',
    fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 16,
    boxSizing: 'border-box',
  }
  const btn = {
    fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)',
    border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer',
    width: '100%', marginTop: 16,
  }
  const heading = { fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }
  const body = { fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7 }

  const goHome = () => router.push('/')

  if (stage === 'checking') return (
    <Shell onLogo={goHome}><div style={{ ...body, textAlign: 'center' }}>Checking your link{'…'}</div></Shell>
  )

  if (stage === 'invalid') return (
    <Shell onLogo={goHome}>
      <div style={{ textAlign: 'center' }}>
        <div style={heading}>This link has expired.</div>
        <div style={{ ...body, marginBottom: 24 }}>
          Reset links work once and only for a while. Ask for a new one and open it in this browser.
        </div>
      </div>
      <button style={btn} onClick={() => router.push('/forgot-password')}>Send a new link</button>
    </Shell>
  )

  if (stage === 'signedin') return (
    <Shell onLogo={goHome}>
      <div style={{ textAlign: 'center' }}>
        <div style={heading}>You{'’'}re already logged in.</div>
        <div style={{ ...body, marginBottom: 24 }}>
          You can change your password in Account settings.
        </div>
      </div>
      <button style={btn} onClick={() => router.push(`/profile/${userId}?tab=account`)}>Go to account settings</button>
    </Shell>
  )

  if (stage === 'done') return (
    <Shell onLogo={goHome}>
      <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 24 }}>{'✓'}</div>
      <div style={{ textAlign: 'center' }}>
        <div style={heading}>Password updated.</div>
        <div style={{ ...body, marginBottom: 24 }}>
          You{'’'}re logged in. Next time, use your new password.
        </div>
      </div>
      <button style={btn} onClick={() => router.push('/')}>Continue</button>
    </Shell>
  )

  return (
    <Shell onLogo={goHome}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...heading, fontSize: 32, marginBottom: 8 }}>Choose a new password.</div>
        <div style={body}>At least 8 characters.</div>
      </div>

      {error && (
        <div role="alert" style={{
          fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E',
          background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={fl} htmlFor="new-password">New password</label>
        <input
          id="new-password"
          style={fi}
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          autoFocus
        />
        <label style={fl} htmlFor="confirm-password">Type it again</label>
        <input
          id="confirm-password"
          style={fi}
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError('') }}
        />
        <label style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
          Show passwords
        </label>
        <button type="submit" style={{ ...btn, opacity: loading ? 0.5 : 1 }} disabled={loading}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </Shell>
  )
}
