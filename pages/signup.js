import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { normalizeTag, normalizeTags } from '../lib/tags'
import { olSearch } from '../lib/olSearch'

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

// Turn a Supabase auth error into a plain explanation plus a short code people
// can quote when they contact us. Supabase sometimes returns an empty message
// ("{}"), most often when the confirmation email couldn't be sent.
const SUPPORT_EMAIL = 'unscriptedbookclub3@gmail.com'

// Signing up with Google leaves the site; this remembers whether they were
// starting a club (and which book) so /signup?oauth=true can pick it up.
const OAUTH_STASH_KEY = 'unscripted_oauth_signup'
const OAUTH_STASH_MAX_MS = 60 * 60 * 1000

function GoogleSignupButton({ onClick, loading }) {
  return (
    <>
      <button type="button" onClick={onClick} disabled={loading}
        style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--sf)', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: loading ? 'default' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxSizing: 'border-box', opacity: loading ? 0.5 : 1 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {loading ? 'Connecting\u2026' : 'Continue with Google'}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '20px 0 24px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
        <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', letterSpacing: 1 }}>or sign up with email</span>
        <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
      </div>
    </>
  )
}
function explainAuthError(err) {
  const msg = String(err?.message || '').trim()
  const low = msg.toLowerCase()
  const status = Number(err?.status) || 0
  const code = (err?.code || (err?.name ? `${String(err.name).replace(/^Auth/, '').replace(/Error$/, '')}-${status || 'x'}` : `ERR-${status || 'x'}`)).toUpperCase()
  const empty = !msg || msg === '{}' || msg === '[object Object]'
  let text
  if (err?.code === 'over_email_send_rate_limit' || status === 429 || low.includes('rate limit')) {
    text = 'We\u2019ve sent too many emails in a short time. Please wait a few minutes and try again.'
  } else if (err?.code === 'email_address_invalid' || (low.includes('email') && low.includes('invalid'))) {
    text = 'That email address doesn\u2019t look right. Check it and try again.'
  } else if (err?.code === 'weak_password' || low.includes('password')) {
    text = 'Please choose a stronger password: at least 8 characters, mixing letters and numbers.'
  } else if (err?.code === 'signup_disabled' || err?.code === 'email_provider_disabled') {
    text = 'New signups are paused right now. Please try again later.'
  } else if (status === 0 && (err?.name === 'AuthRetryableFetchError' || empty)) { // truly unreachable (no response)
    text = 'We couldn\u2019t reach our server. Check your connection and try again.'
  } else if (empty || status >= 500 || low.includes('sending confirmation') || low.includes('database error')) {
    text = `We couldn\u2019t finish creating your account. This usually means the confirmation email couldn\u2019t be sent. Please try again in a few minutes. If it keeps happening, email ${SUPPORT_EMAIL} with the code below.`
  } else {
    text = msg
  }
  return `${text}\nError code: ${code}`
}

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
  // "Confirm email" ON: after signUp there's no session until the email link is
  // clicked. awaitingEmail holds the address while we show "Check your inbox".
  const [awaitingEmail, setAwaitingEmail] = useState('')
  const [resendState, setResendState] = useState('idle') // idle | sending | sent | error

  const [regData, setRD] = useState({
    first: '', last: '', email: '', password: '',
  })
  const [clubData, setCD] = useState({
    name: '', desc: '', privacy: 'invite',
    bookTitle: '', bookAuthor: '', bookCh: '', noCh: false,
    bookKey: null, bookTags: [], // Open Library work ID + subjects of the picked book
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
  const [readerInterestsDone, setRID] = useState(false) // reader flow: interests asked before club suggestions
  const [clubsLoading, setCL] = useState(false)

  // OAuth completion mode (coming from /auth/callback with ?oauth=true)
  const isOAuth = router.query.oauth === 'true'
  const [googleLoading, setGoogleLoading] = useState(false)

  async function signUpWithGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      window.localStorage.setItem(OAUTH_STASH_KEY, JSON.stringify({
        mode: mode || 'individual',
        bookTitle: mode === 'club' ? (clubData.bookTitle || '') : '',
        bookAuthor: mode === 'club' ? (clubData.bookAuthor || '') : '',
        bookKey: mode === 'club' ? (clubData.bookKey || null) : null,
        at: Date.now(),
      }))
    } catch (e) {}
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError('Couldn\u2019t connect to Google. Please try again, or sign up with email.')
      setGoogleLoading(false)
    }
    // On success the browser leaves for Google
  }

  // On OAuth flow, get the existing session and pre-populate email
  useEffect(() => {
    if (!isOAuth) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata || {}
      const full = meta.full_name || meta.name || ''
      setRD(d => ({
        ...d,
        email: session.user.email || '',
        first: meta.given_name || full.split(' ')[0] || '',
        last:  meta.family_name || full.split(' ').slice(1).join(' ') || '',
      }))
      // Started on the signup page? Restore reader vs. host (and the book).
      let stash = null
      try {
        stash = JSON.parse(window.localStorage.getItem(OAUTH_STASH_KEY) || 'null')
        window.localStorage.removeItem(OAUTH_STASH_KEY)
      } catch (e) {}
      if (stash && Date.now() - (stash.at || 0) < OAUTH_STASH_MAX_MS && stash.mode === 'club') {
        if (stash.bookTitle) setCD(d => ({ ...d, bookTitle: stash.bookTitle, bookAuthor: stash.bookAuthor || '', bookKey: stash.bookKey || null }))
        setMode('club')
      } else {
        setMode('individual')
      }
      setStep(0)
    })
  }, [isOAuth])

  // Back from the confirmation email (/auth/callback -> /signup?resume=1):
  // pick up onboarding where they left off. Readers -> interests -> clubs;
  // hosts -> name your club (with any book they started from).
  useEffect(() => {
    if (!router.isReady || router.query.resume !== '1') return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).maybeSingle()
      if (!m) { router.replace('/signup?oauth=true'); return } // no profile yet: finish it
      const md = session.user.user_metadata || {}
      setCU(m)
      setRD(d => ({ ...d, first: m.first_name || '', last: m.last_name || '', email: m.email || session.user.email || '' }))
      if (md.signup_mode === 'club') {
        if (md.book_title) setCD(d => ({ ...d, bookTitle: md.book_title, bookAuthor: md.book_author || '', bookKey: md.book_key || null }))
        setMode('club'); setStep(2)
      } else {
        setMode('individual'); startReaderInterests()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.resume])

  // Arriving from a book page ("Start a club for this book") — carry the book through
  useEffect(() => {
    if (!router.isReady || isOAuth) return
    const { bookTitle, bookAuthor, bookKey } = router.query
    if (!bookTitle) return
    const key = typeof bookKey === 'string' && /^OL\d+W$/i.test(bookKey) ? bookKey : null
    setCD(d => ({ ...d, bookTitle: String(bookTitle), bookAuthor: bookAuthor ? String(bookAuthor) : '', bookKey: key }))
    setMode('club')
    setStep(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.bookTitle])

  // "Popular on unscripted" topics (popular_topics() in SQL): tags real, lively
  // clubs use, ranked by how many members search them. Shown above the
  // hand-picked categories, minus anything already in those. Loaded once, the
  // first time the topics screen opens.
  const [popularTopics, setPopularTopics] = useState([])
  const popularLoaded = useRef(false)
  useEffect(() => {
    if (interestStep !== 2 || popularLoaded.current) return
    popularLoaded.current = true
    const curated = new Set(TOPIC_CATS.flatMap(c => c.tags).map(normalizeTag))
    const titleCase = t => t.replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase())
    supabase.rpc('popular_topics', { p_limit: 12 }).then(({ data }) => {
      const picks = (data || []).map(r => r.topic).filter(t => t && !curated.has(normalizeTag(t)))
      setPopularTopics(picks.slice(0, 6).map(titleCase))
    }).catch(() => {})
  }, [interestStep])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const fl  = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi  = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24, boxSizing: 'border-box' }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer', width: '100%' }

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Ranked club suggestions for a new reader (suggested_clubs() in SQL):
  // open, active, not hidden; ranked by fit with their chosen topics and how
  // lively the club is. Each comes back with a one-line reason.
  async function loadClubs() {
    setCL(true)
    try {
      const topics = [...new Set(selectedTopics.map(normalizeTag).filter(Boolean))]
      const { data: ranked } = await supabase.rpc('suggested_clubs', { p_topics: topics, p_limit: 5 })
      const ids = (ranked || []).map(r => r.club_id)
      if (!ids.length) { setClubs([]); return }
      const { data } = await supabase.from('clubs').select('*, club_members(count), books(title, status)').in('id', ids)
      const byId = new Map((data || []).map(c => [c.id, c]))
      setClubs((ranked || []).filter(r => byId.has(r.club_id)).map(r => ({ ...byId.get(r.club_id), reason: r.reason })))
    } catch { setClubs([]) } finally { setCL(false) }
  }

  // Reader flow: account -> goals -> topics -> Find your rooms
  function startReaderInterests() { setDone(true); setIS(1) }
  async function goToRooms() {
    await saveInterests(createdUser?.id)
    setRID(true); setDone(false); setIS(0); setStep(2)
    loadClubs()
  }
  // Interest screens' exits: readers continue to club suggestions; hosts finish
  const afterInterests = () => (mode === 'individual' ? goToRooms() : finishAndRedirect(createdUser?.id))

  function searchBook(val) {
    setBkQ(val)
    if (timer.current) clearTimeout(timer.current)
    if (val.length < 3) { setBkR([]); return }
    setBkL(true)
    timer.current = setTimeout(async () => {
      try {
        // Shared Open Library search: English editions, carries the work ID
        const hits = await olSearch(val)
        setBkR(hits.slice(0, 6).map(b => ({
          title: b.title,
          author: (b.author || '').split(', ')[0] || 'Unknown',
          year: b.year,
          cover: b.cover ? `https://covers.openlibrary.org/b/id/${b.cover}-S.jpg` : null,
          key: b.key, subjects: b.subjects || [],
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

    const initials = ((regData.first?.[0] || '') + (regData.last?.[0] || '')).toUpperCase()
    const palette = ['#C27A5A', '#5E7A62', '#A0603E', '#7A9A7E', '#B0855A', '#6E8B6E', '#B0A594']
    let ch = 0; const seed = regData.email.trim().toLowerCase()
    for (let i = 0; i < seed.length; i++) ch = (ch * 31 + seed.charCodeAt(i)) >>> 0
    const color = palette[ch % palette.length]

    if (isOAuth) {
      // OAuth user — session already exists, just get their ID
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired. Please try signing in again.'); setLoading(false); return null }
      authUserId = session.user.id
    } else {
      // Email + password — create Supabase Auth user first
      // Name + onboarding context ride along in metadata: the database creates
      // the member profile from it (new_user_profile.sql), and /signup?resume=1
      // uses it to continue onboarding after the confirmation email.
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: regData.email.trim().toLowerCase(),
        password: regData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            first_name: regData.first.trim(),
            last_name: regData.last.trim(),
            initials,
            color,
            signup_mode: mode || 'individual',
            ...(mode === 'club' && clubData.bookTitle ? { book_title: clubData.bookTitle, book_author: clubData.bookAuthor || '', book_key: clubData.bookKey || null } : {}),
          },
        },
      })

      if (authErr) {
        setLoading(false)
        if (authErr.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists.')
          // Show login redirect after a beat
          setTimeout(() => router.push(`/login?email=${encodeURIComponent(regData.email.trim())}`), 1800)
          return null
        }
        console.error('signUp failed', authErr)
        setError(explainAuthError(authErr))
        return null
      }

      // With "Confirm email" on, Supabase hides whether an address is taken:
      // an existing address comes back with no identities.
      if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setLoading(false)
        setError('An account with this email already exists.')
        setTimeout(() => router.push(`/login?email=${encodeURIComponent(regData.email.trim())}`), 1800)
        return null
      }

      // No session = they must confirm their email first. The profile already
      // exists (database trigger); show "Check your inbox".
      if (!authData.session) {
        setLoading(false)
        setAwaitingEmail(regData.email.trim().toLowerCase())
        return null
      }

      authUserId = authData.user.id

      // Confirmation off: the trigger may already have made the profile.
      const { data: existing } = await supabase.from('members').select('*').eq('id', authUserId).maybeSingle()
      if (existing) { setLoading(false); setCU(existing); return existing }
    }

    // Insert member row — using auth user ID as primary key
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
        book_key: clubData.bookKey || null, source: 'openlibrary', added_by: memberId,
        tags: clubData.bookTags || [], tags_norm: normalizeTags(clubData.bookTags || []),
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

      // Bridge: if 2+ clubs now read this title, open a book conversation (never clobbers an existing one).
      if (book) {
        const t = clubData.bookTitle.trim()
        const { data: reading } = await supabase.from('books').select('club_id').ilike('title', t)
        const distinctClubs = new Set((reading || []).map(r => r.club_id).filter(Boolean))
        if (distinctClubs.size >= 2) {
          await supabase.from('bridge_threads').upsert(
            { kind: 'book', anchor: t.toLowerCase(), title: t, subtitle: (clubData.bookAuthor || '').trim() || null, created_by: memberId, auto: true },
            { onConflict: 'kind,anchor', ignoreDuplicates: true }
          )
        }
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
  // Tells /auth/callback this account has finished onboarding (so a later
  // email link doesn't send them back into signup).
  async function markOnboarded() {
    try { await supabase.auth.updateUser({ data: { onboarded: true } }) } catch (e) {}
  }

  async function finishAndRedirect(userId) {
    await saveInterests(userId)
    await markOnboarded()
        const { data: membership } = await supabase
      .from('club_members')
      .select('club_id, role')
      .eq('member_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()
    if (!membership?.club_id) { router.push('/'); return }
    // A brand-new host lands on the club page's share prompt (?created=1), which
    // is where the real invite link lives — copy / email / text against the
    // actual invite_code. Non-hosts just go to the club.
    router.push(membership.role === 'host'
      ? `/club/${membership.club_id}?created=1`
      : `/club/${membership.club_id}`)
  }


  // ── "Check your inbox" (Confirm email ON) ──────────────────────────────────
  async function resendConfirmation() {
    setResendState('sending')
    const { error: err } = await supabase.auth.resend({
      type: 'signup', email: awaitingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setResendState(err ? 'error' : 'sent')
  }
  if (awaitingEmail) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">{'\u2709\uFE0F'}</div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Check your inbox.</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 28 }}>
            We sent a link to <strong style={{ color: 'var(--ink)' }}>{awaitingEmail}</strong>. Tap it to confirm your email, and you{'\u2019'}ll pick up right where you left off.
            <br />It can take a minute. Check spam if you don{'\u2019'}t see it.
          </div>
          <button style={{ ...btnO, width: '100%', opacity: resendState === 'sending' ? 0.5 : 1 }} disabled={resendState === 'sending'} onClick={resendConfirmation}>
            {resendState === 'sending' ? 'Sending\u2026' : 'Resend email'}
          </button>
          {resendState === 'sent' && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--sg)', marginTop: 10 }}>Sent again.</div>}
          {resendState === 'error' && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 10 }}>Couldn{'\u2019'}t resend just now. Wait a minute and try again.</div>}
          <div style={{ marginTop: 20 }}>
            <button style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setAwaitingEmail(''); setResendState('idle'); setRD(d => ({ ...d, password: '' })) }}>
              Wrong email? Go back
            </button>
          </div>
        </div>
      </div>
    )
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
              onClick={afterInterests}
            >
              {mode === 'individual' ? 'Skip — show me clubs' : 'Skip all — I\u2019ll set this up later'}
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

          {(popularTopics.length ? [{ label: 'Popular on unscripted', tags: popularTopics }, ...TOPIC_CATS] : TOPIC_CATS).map(cat => (
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
            onClick={afterInterests}
          >
            {selectedTopics.length >= 3 ? (mode === 'individual' ? 'Find my clubs' : 'Enter unscripted') : `Pick ${3 - selectedTopics.length} more to continue`}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 48 }}>
            <span
              style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }}
              onClick={afterInterests}
            >
              {mode === 'individual' ? 'Skip — show me clubs' : 'Skip — I\u2019ll update this in my profile'}
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

          {/* Interest prompt CTA (readers already answered it before choosing clubs) */}
          {readerInterestsDone ? (
            <button style={btn} onClick={() => finishAndRedirect(createdUser?.id)}>Enter unscripted</button>
          ) : <>
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
          </>}
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
                onClick={() => { setMode('individual'); setStep(0) }}
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
                {!isOAuth && !createdUser && <GoogleSignupButton onClick={signUpWithGoogle} loading={googleLoading} />}
                {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{error}</div>}

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
                  if (createdUser) { startReaderInterests(); return }
                  const user = await createAccount()
                  if (user) startReaderInterests()
                }}>{loading ? 'Creating account…' : 'Continue'}</button>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', textAlign: 'center', lineHeight: 1.6, marginTop: 14 }}>
                  By continuing, you agree to our <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--tc)' }}>Terms</a> and <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--tc)' }}>Privacy Policy</a>, and confirm you{'\u2019'}re 18 or older.
                </div>
              </div>
            )}

            {/* Step 2 — Find clubs */}
            {step === 2 && (
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Find your rooms.</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 32 }}>{selectedTopics.length ? 'Picked for what you love to read. Join any that call to you.' : 'A few lively clubs to start with. Join any that call to you.'}</div>

                {clubsLoading && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Finding clubs for you…</div>}

                {!clubsLoading && clubs.length === 0 && (
                  <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '24px', marginBottom: 12, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No open clubs to suggest yet.</div>
                    <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 16 }}>Be the first: start a club around a book you love and invite your people.</div>
                    <button style={btnO} onClick={async () => { await saveInterests(createdUser?.id); await markOnboarded(); router.push('/create') }}>Start your own club</button>
                  </div>
                )}

                {!clubsLoading && clubs.map(c => {
                  const cb = (c.books || []).find(b => b.status === 'current')
                  return (
                    <div key={c.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 24px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{cb ? cb.title + ' · ' : ''}{c.club_members?.[0]?.count || 0} members</div>
                        {c.reason && <div style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, color: 'var(--tc)', marginTop: 4 }}>{c.reason}</div>}
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
                  <button style={btnO} onClick={() => { setDone(true); setIS(2) }}>Back</button>
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
                {!isOAuth && !createdUser && <GoogleSignupButton onClick={signUpWithGoogle} loading={googleLoading} />}
                {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{error}</div>}

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
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', textAlign: 'center', lineHeight: 1.6, marginTop: 14 }}>
                  By continuing, you agree to our <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--tc)' }}>Terms</a> and <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--tc)' }}>Privacy Policy</a>, and confirm you{'\u2019'}re 18 or older.
                </div>
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
                          onClick={() => { setCD(d => ({ ...d, bookTitle: b.title, bookAuthor: b.author, bookKey: b.key || null, bookTags: b.subjects || [] })); setBkQ(''); setBkR([]) }}>
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
                               <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Invite your people.</div>
                {/* The club row (and its invite_code) doesn't exist until createClub()
                    runs on Launch, so there is no real link to show here yet. This step
                    used to display a fake name-slug link on the wrong domain plus a
                    dead Copy button and a dead email input. Real sharing — copy link,
                    email, text, all against the actual invite_code — happens on the
                    club page's ?created=1 share prompt, which finishAndRedirect sends
                    new hosts to. */}
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 28 }}>
                  Launch {clubData.name ? <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{clubData.name}</span> : 'your club'} and we'll hand you the invite link straight away — ready to copy, email or text.
                </div>
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
