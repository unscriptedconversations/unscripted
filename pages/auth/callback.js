import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { ensureMemberProfile } from '../../lib/auth'
import Logo from '../../components/Logo'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('confirming')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      // supabase-js auto-detects the session from the URL on load when
      // detectSessionInUrl is enabled (default). Give it a moment, then check.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (!session) {
        setStatus('error')
        return
      }

      await ensureMemberProfile(session.user)
      if (cancelled) return
      setStatus('done')
      let dest = '/'
      try {
        const intent = window.localStorage?.getItem?.('unscripted_intent')
        if (intent === 'host') dest = '/club/new'
        window.localStorage?.removeItem?.('unscripted_intent')
      } catch (e) {}
      setTimeout(() => router.push(dest), 800)
    }

    finish()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <title>Confirming — unscripted</title>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        {status === 'confirming' && <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>Confirming your email...</div>}
        {status === 'done' && <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)' }}>You're confirmed. Taking you in...</div>}
        {status === 'error' && <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: '#A0603E' }}>That confirmation link didn't work — try logging in directly.</div>}
      </div>
    </div>
  )
}
