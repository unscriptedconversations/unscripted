import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { getFigure } from '../../lib/figures'
import Logo from '../../components/Logo'

function MemberAvatar({ member, size = 32 }) {
  const fig = member?.avatar_figure ? getFigure(member.avatar_figure) : null
  if (fig) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: fig.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}>
      {fig.icon}
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.31, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>
      {member?.initials || '?'}
    </div>
  )
}

export default function JoinClub() {
  const router = useRouter()
  const { invite_code } = router.query

  const [club, setClub] = useState(null)
  const [members, setMembers] = useState([])
  const [currentBook, setCurrentBook] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | preview | already_member | invalid | joining | joined
  const [error, setError] = useState('')

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: member } = await supabase
        .from('members').select('*').eq('id', session.user.id).single()
      if (member) setCurrentUser(member)
    })
  }, [])

  // ── Load club by invite code ──────────────────────────────────────────────
  useEffect(() => {
    if (!invite_code) return
    loadClub()
  }, [invite_code])

  async function loadClub() {
    setStatus('loading')

    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .eq('invite_code', invite_code)
      .single()

    if (!clubData) { setStatus('invalid'); return }
    setClub(clubData)

    // Load members
    const { data: cm } = await supabase
      .from('club_members')
      .select('*, member:members(*)')
      .eq('club_id', clubData.id)
    if (cm) setMembers(cm.map(x => x.member).filter(Boolean))

    // Load current book
    const { data: books } = await supabase
      .from('books')
      .select('*')
      .eq('club_id', clubData.id)
      .eq('status', 'current')
      .limit(1)
    if (books?.[0]) setCurrentBook(books[0])

    setStatus('preview')
  }

  // ── Check if already a member once both user and club load ────────────────
  useEffect(() => {
    if (!currentUser || !club || status !== 'preview') return
    const isMember = members.some(m => m.id === currentUser.id)
    if (isMember) setStatus('already_member')
  }, [currentUser, club, members, status])

  // ── Join ──────────────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!currentUser) {
      // Not logged in — send to signup with invite code as return param
      router.push(`/signup?invite=${invite_code}`)
      return
    }
    setStatus('joining')
    const { error: err } = await supabase.from('club_members').insert({
      club_id: club.id,
      member_id: currentUser.id,
      role: 'member',
    })
    if (err) {
      setError('Something went wrong. Please try again.')
      setStatus('preview')
      return
    }
    setStatus('joined')
    setTimeout(() => router.push(`/club/${club.id}`), 1800)
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const btn = {
    fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)',
    border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%',
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <Logo />
      <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>Finding your club…</div>
    </div>
  )

  // ── Invalid invite code ───────────────────────────────────────────────────
  if (status === 'invalid') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Invalid invite — unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ padding: '40px 0 56px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <Logo />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>🔍</div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
            This invite has expired.
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 36 }}>
            Invite links can expire or be reset by the host. Ask them to send a new one.
          </div>
          <button style={btn} onClick={() => router.push('/')}>Explore unscripted</button>
        </div>
      </div>
    </div>
  )

  // ── Joined confirmation ───────────────────────────────────────────────────
  if (status === 'joined') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <title>You're in — unscripted</title>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 28px' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 40, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
          You're in.
        </div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7 }}>
          Welcome to {club?.name}. Taking you there now…
        </div>
      </div>
    </div>
  )

  if (!club) return null

  // ── Already a member ──────────────────────────────────────────────────────
  if (status === 'already_member') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>{club.name} — unscripted</title>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ padding: '40px 0 48px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <Logo />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            You're already in {club.name}.
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7 }}>
            Head back to the club to pick up where you left off.
          </div>
        </div>
        <button style={btn} onClick={() => router.push(`/club/${club.id}`)}>
          Go to {club.name}
        </button>
      </div>
    </div>
  )

  // ── Club preview (main state) ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Join {club.name} — unscripted</title>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 28px' }}>
        {/* Logo */}
        <div style={{ padding: '40px 0 48px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <Logo />
        </div>

        {/* Invited by label */}
        <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 20, textAlign: 'center' }}>
          You've been invited
        </div>

        {/* Club card */}
        <div style={{ background: 'var(--ink)', borderRadius: 20, padding: '40px 40px 36px', position: 'relative', overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--tc), var(--sg))' }} />

          <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, color: '#F2EBE0', lineHeight: 1.15, marginBottom: 8 }}>
            {club.name}
          </div>

          {club.tagline && (
            <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--tc)', marginBottom: 12 }}>
              {club.tagline}
            </div>
          )}

          {club.description && (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'rgba(242,235,224,0.6)', lineHeight: 1.7, marginBottom: 24 }}>
              {club.description}
            </div>
          )}

          {/* Currently reading */}
          {currentBook && (
            <div style={{ background: 'rgba(194,122,90,0.18)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(242,235,224,0.5)', marginBottom: 6 }}>
                Currently reading
              </div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 17, fontWeight: 600, fontStyle: 'italic', color: '#F2EBE0' }}>
                {currentBook.title}
              </div>
              {currentBook.author && (
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'rgba(242,235,224,0.5)', marginTop: 2 }}>
                  {currentBook.author}
                </div>
              )}
            </div>
          )}

          {/* Members */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              {members.slice(0, 5).map((m, i) => (
                <div key={m.id} style={{ marginLeft: i ? -8 : 0 }}>
                  <MemberAvatar member={m} size={28} />
                </div>
              ))}
            </div>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'rgba(242,235,224,0.5)' }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Join CTA */}
        <button
          style={{ ...btn, opacity: status === 'joining' ? 0.6 : 1 }}
          disabled={status === 'joining'}
          onClick={handleJoin}
        >
          {status === 'joining'
            ? 'Joining…'
            : currentUser
              ? `Join ${club.name}`
              : 'Create an account to join'}
        </button>

        {/* Log in prompt for existing users */}
        {!currentUser && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>
              Already have an account?{' '}
            </span>
            <span
              style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => router.push(`/login?redirect=/join/${invite_code}`)}
            >
              Log in
            </span>
          </div>
        )}

        <div style={{ paddingBottom: 48 }} />
      </div>
    </div>
  )
}
