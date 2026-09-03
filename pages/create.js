import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import ManualBookAdd from '../components/ManualBookAdd'
import { normalizeTags } from '../lib/tags'

export default function CreateClub() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [privacy, setPrivacy] = useState('open')
  const [themes, setThemes] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [bookCh, setBookCh] = useState('')
  const [noCh, setNoCh] = useState(false)
  const [bkQ, setBkQ] = useState('')
  const [bkR, setBkR] = useState([])
  const [bookIsbn, setBookIsbn] = useState(null)
  const [bookTags, setBookTags] = useState([])
  const [bookKey, setBookKey] = useState(null)
  const [bookSource, setBookSource] = useState('openlibrary')
  const [showIsbn, setShowIsbn] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [intentAuthor, setIntentAuthor] = useState('') // arrived via "Start a club for this author"

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: u } = await supabase.from('members').select('*').eq('id', session.user.id).single()
        if (u) setCurrentUser(u)
      }
      setAuthChecked(true)
    })
  }, [])

  // Prefill from ?bookTitle=&bookAuthor= (e.g. "Start a club for this book")
  useEffect(() => {
    if (!router.isReady) return
    if (router.query.bookTitle) { setBookTitle(String(router.query.bookTitle)); setBkQ(String(router.query.bookTitle)) }
    if (router.query.bookAuthor) {
      setBookAuthor(String(router.query.bookAuthor))
      if (!router.query.bookTitle) setIntentAuthor(String(router.query.bookAuthor))
    }
  }, [router.isReady])

  // Author-only arrival ("Start a club for this author"): surface their books
  // to pick from without treating the author name as a title.
  async function showAuthorBooks(author) {
    try {
      const r = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=6&fields=title,author_name`)
      const d = await r.json()
      setBkR((d.docs || []).map(x => ({ title: x.title, author: (x.author_name || [])[0] || author })))
    } catch { setBkR([]) }
  }

  async function searchBook(v) {
    setBkQ(v); setBookTitle(v)
    if (v.length < 3) { setBkR([]); return }
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(v)}&limit=5&fields=title,author_name`)
      const d = await r.json()
      setBkR((d.docs || []).map(x => ({ title: x.title, author: (x.author_name || [])[0] || '' })))
    } catch { setBkR([]) }
  }

  function pickBook(b) {
    setBookTitle(b.title); setBookAuthor(b.author); setBkQ(b.title); setBkR([])
    setBookIsbn(null); setBookKey(null); setBookSource('openlibrary'); setBookTags([])
  }

  async function create() {
    if (!currentUser || !name.trim() || !desc.trim()) { setError(!name.trim() ? 'Give your club a name.' : 'Add a short description.'); return }
    setError(''); setCreating(true)
    const tags = themes.split(',').map(t => t.trim()).filter(Boolean)

    const { data: club, error: cErr } = await supabase.from('clubs').insert({
      name: name.trim(),
      description: desc.trim(),
      privacy,
      tags,
      creator_id: currentUser.id,
    }).select().single()

    if (cErr || !club) { setError('Could not create the club. Please try again.'); setCreating(false); return }

    await supabase.from('club_members').insert({ club_id: club.id, member_id: currentUser.id, role: 'host' })

    if (bookTitle.trim()) {
      const chapters = noCh ? 0 : parseInt(bookCh) || 0
      const { data: book } = await supabase.from('books').insert({
        title: bookTitle.trim(), author: bookAuthor.trim(),
        total_chapters: chapters, current_chapter: 0,
        status: 'current', display_order: 1, club_id: club.id,
        isbn: bookIsbn, book_key: bookKey, source: bookSource, added_by: currentUser.id,
        tags: bookTags, tags_norm: normalizeTags(bookTags),
      }).select().single()

      if (book && chapters > 0) {
        const threadInserts = Array.from({ length: chapters }, (_, i) => ({
          book_id: book.id, chapter_number: i + 1, title: `Chapter ${i + 1}`, is_active: true,
        }))
        threadInserts.push({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${bookTitle.trim()}`, is_active: true })
        await supabase.from('threads').insert(threadInserts)
      } else if (book) {
        await supabase.from('threads').insert({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${bookTitle.trim()}`, is_active: true })
      }

      // Bridge: if 2+ clubs now read this title, open a book conversation (never clobbers an existing one).
      if (book) {
        const t = bookTitle.trim()
        const { data: reading } = await supabase.from('books').select('club_id').ilike('title', t)
        const distinctClubs = new Set((reading || []).map(r => r.club_id).filter(Boolean))
        if (distinctClubs.size >= 2) {
          await supabase.from('bridge_threads').upsert(
            { kind: 'book', anchor: t.toLowerCase(), title: t, subtitle: bookAuthor.trim() || null, created_by: currentUser.id, auto: true },
            { onConflict: 'kind,anchor', ignoreDuplicates: true }
          )
        }
      }
    }

    router.push(`/club/${club.id}`)
  }

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24, boxSizing: 'border-box' }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '15px 28px', cursor: 'pointer', width: '100%' }

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading…</div></div>

  if (!currentUser) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <title>Start a club — unscripted</title>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Log in to start a club.</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button style={{ ...btn, width: 'auto' }} onClick={() => router.push('/login?redirect=/create')}>Log in</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Start a club — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links"><button className="nav-btn" onClick={() => router.push('/')}>Explore</button></div>
        </nav>

        <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
          <button className="profile-back" onClick={() => router.back()}>← Back</button>

          <div style={{ padding: '24px 0 32px' }}>
            <h1 className="hero-h1" style={{ fontSize: 38, marginBottom: 10 }}>Start a club</h1>
            <p style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)', lineHeight: 1.6 }}>A room of your own — invite readers and pick what you'll read together.</p>
          </div>

          {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', background: 'rgba(160,96,62,0.08)', border: '1px solid rgba(160,96,62,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>{error}</div>}

          <label style={fl}>Club name</label>
          <input style={fi} value={name} onChange={e => setName(e.target.value)} placeholder="The Sunday Readers" autoFocus />

          <label style={fl}>Description</label>
          <textarea style={{ ...fi, resize: 'vertical', minHeight: 90 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this club about?" />

          <label style={fl}>Themes (optional)</label>
          <input style={fi} value={themes} onChange={e => setThemes(e.target.value)} placeholder="grief, identity, coming of age" />

          <label style={fl}>Privacy</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            {[['open', 'Open', 'Anyone can join'], ['invite', 'Invite-only', 'Members you invite']].map(([p, l, d]) => (
              <div key={p} onClick={() => setPrivacy(p)} style={{ flex: 1, padding: '16px 18px', borderRadius: 12, border: privacy === p ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: privacy === p ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{l}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>

          {intentAuthor && !bookTitle.trim() && <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--tcD)', border: '1px solid rgba(194,122,90,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>Starting a club for <b>{intentAuthor}</b> — pick one of their books, or search any title.</div>
            <button onClick={() => showAuthorBooks(intentAuthor)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--tc)', background: 'none', border: '1.5px solid var(--tc)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Show books</button>
          </div>}

          <label style={fl}>First book (optional)</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input style={{ ...fi, marginBottom: 0 }} value={bkQ} onChange={e => searchBook(e.target.value)} placeholder="Search a title…" />
            {bkR.length > 0 && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.1)', zIndex: 20, overflow: 'hidden' }}>
              {bkR.map((b, i) => (
                <div key={i} onClick={() => pickBook(b)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink)' }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}</div>
                </div>
              ))}
            </div>}
          </div>

          <button type="button" onClick={() => setShowIsbn(v => !v)} style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 16 }}>
            {showIsbn ? 'Hide ISBN entry' : 'Can’t find it? Add by ISBN'}
          </button>
          {showIsbn && <div style={{ marginBottom: 16 }}>
            <ManualBookAdd onResolve={b => {
              setBookTitle(b.title); setBookAuthor(b.author); setBkQ(b.title); setBkR([])
              setBookIsbn(b.isbn); setBookKey(b.book_key); setBookSource(b.source); setBookTags(b.tags || [])
              setShowIsbn(false)
            }} />
          </div>}

          {bookTitle.trim() && <div style={{ marginBottom: 28 }}>
            <input style={{ ...fi, marginBottom: 12 }} value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} placeholder="Author" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input style={{ ...fi, marginBottom: 0, opacity: noCh ? 0.4 : 1 }} value={bookCh} onChange={e => setBookCh(e.target.value)} placeholder="Number of chapters" type="number" disabled={noCh} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input type="checkbox" checked={noCh} onChange={e => setNoCh(e.target.checked)} /> No chapters
              </label>
            </div>
          </div>}

          <button style={{ ...btn, opacity: creating || !name.trim() || !desc.trim() ? 0.5 : 1 }} disabled={creating || !name.trim() || !desc.trim()} onClick={create}>{creating ? 'Creating…' : 'Create club'}</button>
        </div>
      </div>
    </div>
  )
}
