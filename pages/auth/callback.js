import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

// Landing page for Google/Apple sign-in and for the "confirm your email" link.
// Routes the person to the right place:
//   - unfinished email signup  -> /signup?resume=1 (continue onboarding)
//   - existing member          -> their first club, or home
//   - signed in, no profile    -> /signup?oauth=true (finish profile)
//   - expired / used link      -> explains it, with a way forward

function linkError() {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = q.get('error_code') || h.get('error_code')
  const desc = q.get('error_description') || h.get('error_description')
  const err = q.get('error') || h.get('error')
  if (!code && !desc && !err) return null
  return { code: code || err || '', desc: desc || '' }
}

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')
  const [failure, setFailure] = useState(null) // { title, body }

  useEffect(() => {
    async function handleCallback() {
      const le = linkError()
      if (le) {
        const expired = /expired|otp|invalid|used/i.test(le.code + ' ' + le.desc)
        setFailure(expired
          ? { title: 'This link has expired.', body: 'Email links work once and only for a while. Log in, and if your email still needs confirming we’ll send a fresh link.' }
          : { title: 'We couldn’t sign you in.', body: 'Something went wrong on the way back. Please try logging in again.' })
        return
      }

      let { data: { session } } = await supabase.auth.getSession()

      // Fallback: exchange a ?code= ourselves if it hasn't been picked up yet
      if (!session) {
        const code = new URLSearchParams(window.location.search).get('code')
        if (code) {
          try {
            const { data } = await supabase.auth.exchangeCodeForSession(code)
            session = data?.session || null
          } catch (e) {}
        }
      }

      if (!session) {
        setFailure({ title: 'We couldn’t sign you in.', body: 'If you opened the link in a different browser or app than the one you signed up in, open it there instead, or just log in.' })
        return
      }

      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!member) {
        // Signed in but no profile yet (e.g. first Google/Apple sign-in)
        setStatus('Almost there…')
        router.replace('/signup?oauth=true')
        return
      }

      // Email signup that hasn't finished onboarding: continue where they left off
      const md = session.user.user_metadata || {}
      if (md.signup_mode && !md.onboarded) {
        setStatus('Email confirmed. Picking up where you left off…')
        router.replace('/signup?resume=1')
        return
      }

      // Existing member — route to their first club
      const { data: membership } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('member_id', member.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      setStatus('Welcome back.')
      router.replace(membership?.club_id ? `/club/${membership.club_id}` : '/')
    }

    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32, padding: '40px 24px',
    }}>
      <Logo />
      {failure ? (
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>{failure.title}</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 24 }}>{failure.body}</div>
          <button
            onClick={() => router.replace('/login')}
            style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--tc)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer' }}
          >
            Go to log in
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>
          {status}
        </div>
      )}
    </div>
  )
}
