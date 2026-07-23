import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

// ── Interest prompt data ────────────────────────────────────────────────────
const GOALS = [
  { id: 'community',  label: 'Connect with a community',  emoji: '🤝' },
  { id: 'voices',     label: 'Discover new voices',       emoji: '🔍' },
  { id: 'consistent', label: 'Read more consistently',    emoji: '📅' },
  { id: 'challenge',  label: 'Challenge my thinking',     emoji: '💡' },
  { id: 'revisit',    label: 'Revisit books I\'ve loved', emoji: '❤️' },
  { id: 'genres',     label: 'Explore new genres',        emoji: '🗺️' },
]

const TOPIC_CATS = [
  {
    label: 'Literary Fiction',
    tags: ['Identity', 'Coming of Age', 'Diaspora', 'Family', 'Love & Grief'],
  },
  {
    label: 'Speculative Fiction',
    tags: ['Afrofuturism', 'Dystopia', 'Science Fiction', 'Fantasy', 'Horror'],
  },
  {
    label: 'Non-Fiction',
    tags: ['Memoir', 'History', 'Politics', 'Essays', 'Biography'],
  },
  {
    label: 'Poetry & Essays',
    tags: ['Poetry', 'Personal Essays', 'Prose Poetry', 'Cultural Criticism'],
  },
]

export default function Signup() {
  const router = useRouter()

  // ── Core flow state ────────────────────────────────────────────────────────
  const [mode, setMode]         = useState(null)
  const [step, setStep]         = useState(0)
  const [joinedClubs, setJC]    = useState({})
  const [clubs, setClubs]       = useState([])
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [createdUser, setCU]    = useState(null)
  const [showPw, setShowPw]     = useState(false)

  const [regData, setRD] = useState({
    first: '', last: '', email: '', password: '',
  })
  const [clubData, setCD] = useState({
    name: '', desc: '', privacy: 'invite',
    bookTitle: '', bookAuthor: '', bookCh: '', noCh: false,
  })

  // Book search
  const [bkQ, setBkQ] = useState('')
  const [bkR, setBkR] = useState([])
  const [bkL, setBkL] = useState(false)
  const timer = useRef(null)

  // Interest prompt (post-signup)
  const [interestStep, setIS]      = useState(0)  // 0=done screen, 1=goals, 2=topics
  const [selectedGoals, setSGoals] = useState([])
  const [selectedTopics, setSTopics] = useState([])
  const [done, setDone]            = useState(false)

  // OAuth completion mode (coming from /auth/callback with ?oauth=true)
  const isOAuth = router.query.oauth === 'true'

  // On OAuth flow, get the existing session and pre-populate email
  useEffect(() => {
    if (!isOAuth) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata
      setRD(d => ({
        ...d,
        email: session.user.email || '',
        first: meta?.full_name?.split(' ')[0] || '',
        last:  meta?.full_name?.split(' ').slice(1).join(' ') || '',
      }))
      // Pre-select mode as individual for OAuth flow
      setMode('individual')
      setStep(0)
    })
  }, [isOAuth])

  // Arriving from a book page ("Start a club for this book") — carry the book through
  useEffect(() => {
    if (!router.isReady || isOAuth) return
    const { bookTitle, bookAuthor } = router.query
    if (!bookTitle) return
    setCD(d => ({ ...d, bookTitle: String(bookTitle), bookAuthor: bookAuthor ? String(bookAuthor) : '' }))
    setMode('club')
    setStep(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.bookTitle])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const fl  = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi  = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24, boxSizing: 'border-box' }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer', width: '100%' }

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function loadClubs() {
    const { data } = await supabase
      .from('clubs')
      .select('*, club_members(count), books(title, status)')
    if (data) setClubs(data)
  }

  function searchBook(val) {
    setBkQ(val)
    if (timer.current) clearTimeout(timer.current)
    if (val.length < 3) { setBkR([]); return }
    setBkL(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(val)}&limit=5&fields=title,author_name,first_publish_year,cover_i`)
        const d = await r.json()
        setBkR((d.docs || []).map(b => ({
          title: b.title,
          author: (b.author_name || [])[0] || 'Unknown',
          year: b.first_publish_year,
          cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null,
        })))
      } catch { setBkR([]) }
      setBkL(false)
    }, 400)
  }

  function toggleGoal(id) {
    setSGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  function toggleTopic(tag) {
    setSTopics(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // ── Account creation (fixed — uses Supabase Auth) ─────────────────────────
  async function createAccount() {
    setError('')

    // Validate all required fields
    if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) {
      setError('First name, last name, and email are required.'); return null
    }
    if (!isOAuth) {
      if (!regData.password) {
        setError('Please create a password.'); return null
      }
      if (regData.password.length < 8) {
        setError('Password must be at least 8 characters.'); return null
      }
    }

    setLoading(true)

    let authUserId

    if (isOAuth) {
      // OAuth user — session already exists, just get their ID
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired. Please try signing in again.'); setLoading(false); return null }
      authUserId = session.user.id
    } else {
      // Email + password — create Supabase Auth user first
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: regData.email.trim().toLowerCase(),
        password: regData.password,
      })

      if (authErr) {
        setLoading(false)
        if (authErr.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists.')
          // Show login redirect after a beat
          setTimeout(() => router.push(`/login?email=${encodeURIComponent(regData.email.trim())}`), 1800)
          return null
        }
        setError(authErr.message)
        return null
      }

      authUserId = authData.user.id
    }

    // Insert member row — using auth user ID as primary key
    const initials = ((regData.first?.[0] || '') + (regData.last?.[0] || '')).toUpperCase()
    const palette = ['#C27A5A', '#5E7A62', '#A0603E', '#7A9A7E', '#B0855A', '#6E8B6E', '#B0A594']
    let ch = 0; const seed = regData.email.trim().toLowerCase()
    for (let i = 0; i < seed.length; i++) ch = (ch * 31 + seed.charCodeAt(i)) >>> 0
    const color = palette[ch % palette.length]

    const { data: member, error: memberErr } = await supabase
      .from('members')
      .insert({
        id: authUserId,
        first_name: regData.first.trim(),
        last_name: regData.last.trim(),
        email: regData.email.trim().toLowerCase(),
        initials,
        color,
      })
      .select()
      .single()

    setLoading(false)

    if (memberErr) {
      setError('Could not create your profile. Please try again.')
      return null
    }

    setCU(member)
    return member
  }

  async function joinClub(clubId, memberId) {
    await supabase.from('club_members').insert({
      club_id: clubId, member_id: memberId, role: 'member',
    })
  }

  async function createClub(memberId) {
    const { data: club } = await supabase.from('clubs').insert({
      name: clubData.name.trim(),
      description: clubData.desc.trim(),
      privacy: clubData.privacy,
      creator_id: memberId,
    }).select().single()
    if (!club) return

    await supabase.from('club_members').insert({
      club_id: club.id, member_id: memberId, role: 'host',
    })

    if (clubData.bookTitle) {
      const chapters = clubData.noCh ? 0 : parseInt(clubData.bookCh) || 0
      const { data: book } = await supabase.from('books').insert({
        title: clubData.bookTitle, author: clubData.bookAuthor,
        total_chapters: chapters, current_chapter: 0,
        status: 'current', display_order: 1, club_id: club.id,
      }).select().single()

      if (book && chapters > 0) {
        const threadInserts = Array.from({ length: chapters }, (_, i) => ({
          book_id: book.id, chapter_number: i + 1, title: `Chapter ${i + 1}`, is_active: true,
        }))
        threadInserts.push({
          book_id: book.id, chapter_number: 0,
          title: `Open Discussion: ${clubData.bookTitle}`, is_active: true,
        })
        await supabase.from('threads').insert(threadInserts)
      } else if (book) {
        await supabase.from('threads').insert({
          book_id: book.id, chapter_number: 0,
          title: `Open Discussion: ${clubData.bookTitle}`, is_active: true,
        })
      }
    }
    return club
  }

  // Save interest prompt selections (graceful — columns may not exist yet)
  async function saveInterests(userId) {
    if (!userId) return
    try {
      const updates = {}
      if (selectedGoals.length > 0)  updates.reading_goals    = selectedGoals
      if (selectedTopics.length > 0) updates.member_interests = selectedTopics
      if (Object.keys(updates).length > 0) {
        await supabase.from('members').update(updates).eq('id', userId)
      }
    } catch { /* columns not yet in schema — fail silently */ }
  }

  // Final redirect after interest prompt
  async function finishAndRedirect(userId) {
    await saveInterests(userId)
    const { data: membership } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('member_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    router.push(membership?.club_id ? `/club/${membership.club_id}` : '/')
  }


  // ── Interest prompt — Goals step ─────────────────────────────────────────
  if (done && interestStep === 1) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <title>What are you reading for? — unscripted</title>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ padding: '40px 0 0', display: 'flex', justifyContent: 'center' }}><Logo /></div>

          {/* Progress indicator */}
          <div style={{ display: 'flex', gap: 6, margin: '32px 0 40px' }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--tc)' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bd)' }} />
          </div>

          <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.2 }}>
            What are you reading for?
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 36, lineHeight: 1.6 }}>
            We'll use this to find the right clubs for you. Pick as many as you like.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
            {GOALS.map(g => {
              const sel = selectedGoals.includes(g.id)
              return (
                <div
                  key={g.id}
                  onClick={() => toggleGoal(g.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px', borderRadius: 14, cursor: 'pointer',
                    background: sel ? 'rgba(194,122,90,0.06)' : 'var(--sf)',
                    border: sel ? '2px solid var(--tc)' : '1.5px solid var(--bd)',
                    transition: 'border 0.15s, background 0.15s',
                  }}
                >
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', fontWeight: sel ? 600 : 400 }}>
                    {g.label}
                  </span>
                  <span style={{ fontSize: 22 }}>{g.emoji}</span>
                </div>
              )
            })}
          </div>

          <button style={btn} onClick={() => setIS(2)}>
            {selectedGoals.length > 0 ? 'Continue' : 'Skip'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 48 }}>
            <span
              style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }}
              onClick={() => finishAndRedirect(createdUser?.id)}
            >
              Skip all — I'll set this up later
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Interest prompt — Topics step ────────────────────────────────────────
  if (done && interestStep === 2) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <title>What topics call to you? — unscripted</title>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ padding: '40px 0 0', display: 'flex', justifyContent: 'center' }}><Logo /></div>

          <div style={{ display: 'flex', gap: 6, margin: '32px 0 40px' }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--tc)' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--tc)' }} />
          </div>

          <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.2 }}>
            What topics call to you?
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 36, lineHeight: 1.6 }}>
            Pick at least 3 and we'll show you clubs you'll actually want to be in.
          </div>

          {TOPIC_CATS.map(cat => (
            <div key={cat.label} style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 14 }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.tags.map(tag => {
                  const sel = selectedTopics.includes(tag)
                  return (
                    <div
                      key={tag}
                      onClick={() => toggleTopic(tag)}
                      style={{
                        padding: '9px 16px', borderRadius: 24, cursor: 'pointer',
                        fontFamily: 'var(--ui)', fontSize: 13, fontWeight: sel ? 600 : 400,
                        color: sel ? 'var(--tc)' : 'var(--ink)',
                        background: sel ? 'rgba(194,122,90,0.08)' : 'var(--sf)',
                        border: sel ? '1.5px solid var(--tc)' : '1.5px solid var(--bd2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tag}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ height: 1, background: 'var(--bd)', margin: '8px 0 32px' }} />

          <button
            style={{ ...btn, opacity: selectedTopics.length >= 3 ? 1 : 0.7 }}
            onClick={() => finishAndRedirect(createdUser?.id)}
          >
            {selectedTopics.length >= 3 ? 'Enter unscripted' : `Pick ${3 - selectedTopics.length} more to continue`}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 48 }}>
            <span
              style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }}
              onClick={() => finishAndRedirect(createdUser?.id)}
            >
              Skip — I'll update this in my profile
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── "You're in" screen ────────────────────────────────────────────────────
  if (done && interestStep === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <title>Welcome to unscripted</title>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 28px' }}>
          <div style={{ marginBottom: 32 }}><Logo /></div>
          {createdUser && (
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: createdUser.color || '#C27A5A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF',
              margin: '0 auto 24px', border: '3px solid rgba(255,255,255,0.15)',
            }}>
              {createdUser.initials || ((regData.first?.[0] || '') + (regData.last?.[0] || '')).toUpperCase()}
            </div>
          )}
          <div style={{ fontFamily: 'var(--hd)', fontSize: 40, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            You're in.
          </div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 40 }}>
            {mode === 'individual'
              ? 'Welcome to unscripted. The conversations are waiting.'
              : `${clubData.name || 'Your club'} is live. Share the invite link and start reading together.`}
          </div>

          {/* Interest prompt CTA */}
          <div style={{
            background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 16,
            padding: '24px 28px', marginBottom: 16, textAlign: 'left',
          }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 8 }}>
              Optional — takes 30 seconds
            </div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              Help us find the right clubs for you.
            </div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 20 }}>
              Tell us what you're here for and what you love to read. We'll use it to suggest clubs that actually fit.
            </div>
            <button style={btn} onClick={() => setIS(1)}>
              Let's do it
            </button>
          </div>

          <button
            style={{ ...btnO, fontSize: 11 }}
            onClick={() => finishAndRedirect(createdUser?.id)}
          >
            Skip — I'll explore on my own
          </button>
        </div>
      </div>
    )
  }

  // ── Main signup flow ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <title>Join unscripted</title>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 28px' }}>
        <div
          style={{ padding: '32px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <Logo />
        </div>

        {/* ── MODE SELECT ────────────────────────────────────────────────── */}
        {!mode && (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 36, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
                How do you want<br />to <em style={{ fontStyle: 'italic', color: 'var(--tc)' }}>read?</em>
              </div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)' }}>
                Join as a reader or start your own book club.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }}
                onClick={() => { setMode('individual'); setStep(0); loadClubs() }}
              >
                <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 12 }}>Reader</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Join as an individual</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Create your profile and browse book clubs to join.</div>
              </div>

              <div
                style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }}
                onClick={() => { setMode('club'); setStep(0) }}
              >
                <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sg)', marginBottom: 12 }}>Host</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Start a book club</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Create your club, set your first book, and invite your people.</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <span style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Already have an account? </span>
              <span
                style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => router.push('/login')}
              >
                Log in
              </span>
            </div>
          </div>
        )}

        {/* ── INDIVIDUAL FLOW ───────────────────────────────────────────── */}
        {mode === 'individual' && !done && (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
              {['About you', 'Find clubs'].map((l, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 3, borderRadius: 2, background: i <= (step > 1 ? step - 1 : step) ? 'var(--tc)' : 'var(--bd)', marginBottom: 8 }} />
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: i <= (step > 1 ? step - 1 : step) ? 'var(--tc)' : 'var(--txD)' }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Step 0 — About you */}
            {step === 0 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Tell us about yourself.</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 32 }}>Just the basics to get started.</div>
                {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>{error}</div>}

                <label style={fl}>First Name</label>
                <input style={fi} placeholder="First name" value={regData.first} onChange={e => setRD(d => ({ ...d, first: e.target.value }))} />

                <label style={fl}>Last Name</label>
                <input style={fi} placeholder="Last name" value={regData.last} onChange={e => setRD(d => ({ ...d, last: e.target.value }))} />

                <label style={fl}>Email</label>
                <input style={fi} placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRD(d => ({ ...d, email: e.target.value }))} disabled={isOAuth} />

                {!isOAuth && <>
                  <label style={fl}>Password</label>
                  <div style={{ position: 'relative', marginBottom: 24 }}>
                    <input
                      style={{ ...fi, marginBottom: 0, paddingRight: 52 }}
                      type={showPw ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={regData.password}
                      onChange={e => setRD(d => ({ ...d, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </>}

                <button style={{ ...btn, opacity: loading ? 0.5 : 1 }} disabled={loading} onClick={async () => {
                  setError('')
                  if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) { setError('All fields are required.'); return }
                  if (!isOAuth && regData.password.length < 8) { setError('Password must be at least 8 characters.'); return }
                  if (createdUser) { setStep(2); return }
                  const user = await createAccount()
                  if (user) setStep(2)
                }}>{loading ? 'Creating account…' : 'Continue'}</button>
              </div>
            )}

            {/* Step 2 — Find clubs */}
            {step === 2 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Find your rooms.</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 32 }}>Browse clubs and join the ones that call to you.</div>

                {clubs.map(c => {
                  const cb = (c.books || []).find(b => b.status === 'current')
                  return (
                    <div key={c.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 24px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{cb ? cb.title + ' · ' : ''}{c.club_members?.[0]?.count || 0} members</div>
                      </div>
                      <button
                        style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: joinedClubs[c.id] ? 'var(--sg)' : 'var(--ink)', background: joinedClubs[c.id] ? 'rgba(94,122,98,0.1)' : 'none', border: joinedClubs[c.id] ? 'none' : '1.5px solid var(--bd2)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', minWidth: 80 }}
                        onClick={async () => {
                          if (!joinedClubs[c.id] && createdUser) await joinClub(c.id, createdUser.id)
                          setJC(p => ({ ...p, [c.id]: !p[c.id] }))
                        }}
                      >
                        {joinedClubs[c.id] ? 'Joined ✓' : 'Join'}
                      </button>
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button style={btnO} onClick={() => setStep(0)}>Back</button>
                  <button style={{ ...btn, flex: 1 }} onClick={() => setDone(true)}>Enter unscripted</button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }} onClick={() => setDone(true)}>Skip — I'll explore later</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BOOK CLUB FLOW ────────────────────────────────────────────── */}
        {mode === 'club' && !done && (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
              {['About you', 'Your club', 'First book', 'Invite'].map((l, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 3, borderRadius: 2, background: i <= (step > 1 ? step - 1 : step) ? 'var(--tc)' : 'var(--bd)', marginBottom: 8 }} />
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: i <= (step > 1 ? step - 1 : step) ? 'var(--tc)' : 'var(--txD)' }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Step 0 — About you */}
            {step === 0 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>First, create your profile.</div>
                {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>{error}</div>}

                <label style={fl}>First Name</label>
                <input style={fi} placeholder="First name" value={regData.first} onChange={e => setRD(d => ({ ...d, first: e.target.value }))} />
                <label style={fl}>Last Name</label>
                <input style={fi} placeholder="Last name" value={regData.last} onChange={e => setRD(d => ({ ...d, last: e.target.value }))} />
                <label style={fl}>Email</label>
                <input style={fi} placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRD(d => ({ ...d, email: e.target.value }))} />

                <label style={fl}>Password</label>
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <input
                    style={{ ...fi, marginBottom: 0, paddingRight: 52 }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={regData.password}
                    onChange={e => setRD(d => ({ ...d, password: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>

                <button style={{ ...btn, opacity: loading ? 0.5 : 1 }} disabled={loading} onClick={async () => {
                  setError('')
                  if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) { setError('All fields are required.'); return }
                  if (regData.password.length < 8) { setError('Password must be at least 8 characters.'); return }
                  if (createdUser) { setStep(2); return }
                  const user = await createAccount()
                  if (user) setStep(2)
                }}>{loading ? 'Creating account…' : 'Continue'}</button>
              </div>
            )}

            {/* Step 2 — Name your club */}
            {step === 2 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>Name your club.</div>
                <label style={fl}>Club Name</label>
                <input style={fi} placeholder="What's it called?" value={clubData.name} onChange={e => setCD(d => ({ ...d, name: e.target.value }))} />
                <label style={fl}>Description</label>
                <input style={fi} placeholder="One sentence — what's this club about?" value={clubData.desc} onChange={e => setCD(d => ({ ...d, desc: e.target.value }))} />
                <label style={fl}>Privacy</label>
                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                  {['invite', 'open'].map(p => (
                    <div key={p} style={{ flex: 1, padding: '18px 20px', borderRadius: 12, border: clubData.privacy === p ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: clubData.privacy === p ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: 'pointer', textAlign: 'center' }} onClick={() => setCD(d => ({ ...d, privacy: p }))}>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p === 'invite' ? 'Invite Only' : 'Open'}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{p === 'invite' ? 'Members join via link' : 'Anyone can find & join'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={btnO} onClick={() => setStep(0)}>Back</button>
                  <button style={{ ...btn, flex: 1 }} onClick={() => setStep(3)}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 3 — First book */}
            {step === 3 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 24 }}>What's the first book?</div>
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <label style={fl}>Search for a book</label>
                  {router.query.bookTitle && clubData.bookTitle === String(router.query.bookTitle) && (
                    <div style={{ background: 'var(--tcD)', border: '1px solid var(--tc)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600 }}>
                      Starting a club for “{clubData.bookTitle}” — you can change it below.
                    </div>
                  )}
                  <input style={{ ...fi, marginBottom: 0 }} placeholder="Start typing a title..." value={bkQ} onChange={e => searchBook(e.target.value)} />
                  {(bkR.length > 0 || bkL) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
                      {bkL && <div style={{ padding: '16px 20px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Searching…</div>}
                      {bkR.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}
                          onClick={() => { setCD(d => ({ ...d, bookTitle: b.title, bookAuthor: b.author })); setBkQ(''); setBkR([]) }}>
                          {b.cover ? <img src={b.cover} style={{ width: 32, height: 44, borderRadius: 4, objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 20 }}>📖</span>}
                          <div>
                            <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{b.title}</div>
                            <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}{b.year ? ` · ${b.year}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {clubData.bookTitle && (
                  <div style={{ background: 'var(--sf2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{clubData.bookTitle}</div>
                    <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 12 }}>{clubData.bookAuthor}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', marginBottom: clubData.noCh ? 0 : 16 }}>
                      <input type="checkbox" checked={clubData.noCh} onChange={e => setCD(d => ({ ...d, noCh: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--tc)' }} />
                      No numbered chapters
                    </label>
                    {!clubData.noCh && (
                      <div style={{ marginTop: 16 }}>
                        <label style={fl}>How many chapters?</label>
                        <input style={{ ...fi, marginBottom: 0 }} type="number" placeholder="e.g. 12" value={clubData.bookCh} onChange={e => setCD(d => ({ ...d, bookCh: e.target.value }))} />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={btnO} onClick={() => setStep(2)}>Back</button>
                  <button style={{ ...btn, flex: 1 }} onClick={() => setStep(4)}>{clubData.bookTitle ? 'Continue' : 'Skip — add later'}</button>
                </div>
              </div>
            )}

            {/* Step 4 — Invite */}
            {step === 4 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>Invite your people.</div>
                <label style={fl}>Shareable Link</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  <div style={{ flex: 1, padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txM)' }}>
                    unscripted.club/join/{(clubData.name || 'your-club').toLowerCase().replace(/\s+/g, '-')}
                  </div>
                  <button style={{ ...btnO, width: 'auto', padding: '12px 18px' }}>Copy</button>
                </div>
                <label style={fl}>Invite by Email</label>
                <input style={fi} placeholder="name@email.com, name@email.com" />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={btnO} onClick={() => setStep(3)}>Back</button>
                  <button
                    style={{ ...btn, flex: 1 }}
                    onClick={async () => {
                      if (createdUser) await createClub(createdUser.id)
                      setDone(true)
                    }}
                  >
                    Launch club
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <span
                    style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }}
                    onClick={async () => { if (createdUser) await createClub(createdUser.id); setDone(true) }}
                  >
                    Skip — I'll invite later
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back to mode select */}
        {mode && !done && (
          <div style={{ textAlign: 'center', paddingBottom: 48 }}>
            <button
              style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode(null); setStep(0); setError('') }}
            >
              ← Back to sign up options
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
