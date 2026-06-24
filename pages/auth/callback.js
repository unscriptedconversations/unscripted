import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    async function handleCallback() {
      // Supabase automatically exchanges the code for a session from the URL hash
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setStatus('Something went wrong. Redirecting…')
        setTimeout(() => router.replace('/login'), 2000)
        return
      }

      // Check if a member profile exists for this auth user
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (member) {
        // Existing member — route to their first club
        const { data: membership } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('member_id', member.id)
          .order('joined_at', { ascending: true })
          .limit(1)
          .single()

        setStatus('Welcome back.')
        router.replace(membership?.club_id ? `/club/${membership.club_id}` : '/')
      } else {
        // New OAuth user — no member profile yet, send to finish setup
        setStatus('Almost there…')
        router.replace('/signup?oauth=true')
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32,
    }}>
      <Logo />
      <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>
        {status}
      </div>
    </div>
  )
}
