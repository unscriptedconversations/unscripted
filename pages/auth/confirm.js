import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

// Landing page for links in the Supabase emails (Confirm signup, Reset
// password). The email templates link here, on our own domain:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
// so the link and the sender share a domain (better for spam filters), and the
// link is only used up when the page runs in a real browser, not when an email
// security scanner opens it.
//
// Then it hands over to the existing pages (full reload, so they read the URL
// fresh):
//   confirmed signup -> /auth/callback (routes to onboarding, club or home)
//   reset password   -> /reset-password?type=recovery
//   bad/expired link -> /auth/callback with the error, which explains it

const ALLOWED = ['email', 'signup', 'recovery', 'magiclink', 'invite']

export default function AuthConfirm() {
  const [status, setStatus] = useState('Checking your link…')

  useEffect(() => {
    async function run() {
      const q = new URLSearchParams(window.location.search)
      const tokenHash = q.get('token_hash') || ''
      const type = q.get('type') || ''
      const fail = (code, desc) => window.location.replace(`/auth/callback#error_code=${encodeURIComponent(code)}&error_description=${encodeURIComponent(desc)}`)

      if (!tokenHash || !ALLOWED.includes(type)) { fail('invalid_link', 'Link is invalid'); return }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) {
        // Already used? A confirmed signup may still have a session in this browser.
        const { data: { session } } = await supabase.auth.getSession()
        if (session && type !== 'recovery') { window.location.replace('/auth/callback'); return }
        fail(error.code || 'otp_expired', error.message || 'Link has expired')
        return
      }

      if (type === 'recovery') {
        setStatus('Link confirmed. Opening the password page…')
        window.location.replace('/reset-password?type=recovery')
        return
      }
      setStatus('Email confirmed…')
      window.location.replace('/auth/callback')
    }
    run()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32, padding: '40px 24px',
    }}>
      <title>Confirming — unscripted</title>
      <Logo />
      <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>{status}</div>
    </div>
  )
}
