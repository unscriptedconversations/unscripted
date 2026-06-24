import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSSOLoading] = useState(null) // 'google' | 'apple'
  const [error, setError] = useState('')

  // ── Styles (matching existing codebase patterns) ────────────────────────
  const fl = {
    fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700,
    letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)',
    marginBottom: 10, display: 'block',
  }
  const fi = {
    width: '100%', padding: '14px 18px', background: 'var(--bg)',
    border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)',
    fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24,
    boxSizing: 'border-box',
  }
  const btn = {
    fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)',
    border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer',
    width: '100%', opacity: loading ? 0.5 : 1,
  }
  const ssoBtn = {
    fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
    background: 'var(--sf)', border: '1.5px solid var(--bd2)', borderRadius: 10,
    padding: '13px 28px', cursor: 'pointer', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 12, boxSizing: 'border-box',
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (err) {
      if (err.message.toLowerCase().includes('invalid')) {
        setError('Incorrect email or password.')
      } else if (err.message.toLowerCase().includes('rate')) {
        setError('Too many attempts. Please try again in a few minutes.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      return
    }
    // Fetch member profile and route to their club
    if (data.session) {
      const { data: member } = await supabase
        .from('members')
        .select('*')
        .eq('id', data.session.user.id)
        .single()
      if (member) {
        // Find first club membership
        const { data: membership } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('member_id', member.id)
          .order('joined_at', { ascending: true })
          .limit(1)
          .single()
        router.push(membership?.club_id ? `/club/${membership.club_id}` : '/')
      } else {
        // Auth user exists but no member profile — finish setup
        router.push('/signup?complete=true')
      }
    }
  }

  async function handleSSO(provider) {
    setError('')
    setSSOLoading(provider)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (err) {
      setError('Could not connect. Please try again.')
      setSSOLoading(null)
    }
    // On success the browser redirects — no need to unset loading
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Log in — unscripted</title>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        {/* Logo */}
        <div
          style={{ padding: '40px 0 48px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <Logo />
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            Welcome back.
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>
            Your clubs are waiting.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E',
            background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ marginBottom: 28 }}>
          <label style={fl}>Email</label>
          <input
            style={fi}
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />

          <label style={fl}>Password</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              style={{ ...fi, marginBottom: 0, paddingRight: 52 }}
              type={showPw ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', fontWeight: 600,
                letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'right', marginBottom: 28 }}>
            <span
              style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => router.push('/forgot-password')}
            >
              Forgot password?
            </span>
          </div>

          <button type="submit" style={btn} disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
          <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', letterSpacing: 1 }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
        </div>

        {/* Google SSO */}
        <button
          style={{ ...ssoBtn, opacity: ssoLoading === 'google' ? 0.5 : 1 }}
          onClick={() => handleSSO('google')}
          disabled={!!ssoLoading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {ssoLoading === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>

        {/* Apple SSO */}
        <button
          style={{ ...ssoBtn, background: 'var(--ink)', color: '#FFF', border: 'none', opacity: ssoLoading === 'apple' ? 0.5 : 1 }}
          onClick={() => handleSSO('apple')}
          disabled={!!ssoLoading}
        >
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <path d="M13.173 9.558c-.022-2.185 1.786-3.244 1.867-3.295-1.017-1.49-2.601-1.694-3.162-1.715-1.346-.136-2.63.794-3.312.794-.681 0-1.734-.775-2.852-.754C4.1 4.611 2.587 5.648 1.757 7.22.054 10.403 1.312 15.1 2.962 17.671c.814 1.163 1.779 2.47 3.046 2.422 1.224-.049 1.683-.785 3.161-.785 1.478 0 1.894.785 3.186.762 1.314-.022 2.145-1.185 2.952-2.353.934-1.346 1.317-2.655 1.338-2.72-.03-.014-2.554-.976-2.472-3.44zM10.897 2.956C11.58 2.134 12.04.98 11.911-.21c-1.007.043-2.228.67-2.95 1.492-.646.74-1.213 1.929-1.06 3.065 1.125.086 2.273-.55 2.996-1.39z" fill="white"/>
          </svg>
          {ssoLoading === 'apple' ? 'Connecting…' : 'Continue with Apple'}
        </button>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 36, paddingBottom: 48 }}>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>
            New to unscripted?{' '}
          </span>
          <span
            style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => router.push('/signup')}
          >
            Join for free
          </span>
        </div>
      </div>
    </div>
  )
}le={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
