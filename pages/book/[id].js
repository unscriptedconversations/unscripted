import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function BookPage() {
  const router = useRouter()
  const { id } = router.query
  const [book, setBook] = useState(null)
  const [clubs, setClubs] = useState([])
  const [bookKey, setBookKey] = useState(null)
  const [coverUrl, setCoverUrl] = useState(null)
  const [threadCount, setThreadCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => { if (id) loadBook() }, [id])

  async function loadBook() {
    const { data: b } = await supabase.from('books').select('*').eq('id', id).single()
    if (!b) return
    setBook(b)
    setBookKey(b.book_key)

    // All copies of this book across clubs (matched by title, same as before)
    const { data: allBooks } = await supabase.from('books').select('*, club:clubs(*)').eq('title', b.title)
    const rows = allBooks || []
    setClubs(rows.map(ab => ab.club).filter(Boolean))

    const bookIds = rows.map(r => r.id)
    const clubIds = rows.map(r => r.club_id).filter(Boolean)

    // Stat: total discussion threads across every club reading this
    if (bookIds.length) {
      const { count } = await supabase.from('threads').select('id', { count: 'exact', head: true }).in('book_id', bookIds)
      setThreadCount(count || 0)
    }
    // Stat: members across every club reading this
    if (clubIds.length) {
      const { count } = await supabase.from('club_members').select('id', { count: 'exact', head: true }).in('club_id', clubIds)
      setMemberCount(count || 0)
    }

    fetchCover(b.title, b.author)
  }

  // Pull cover art live from Open Library (books table doesn't store one)
  async function fetchCover(title, author) {
    try {
      const q = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=1&fields=cover_i`
      const r = await fetch(q)
      const d = await r.json()
      const ci = d.docs?.[0]?.cover_i
      if (ci) setCoverUrl(`https://covers.openlibrary.org/b/id/${ci}-L.jpg`)
    } catch { /* no cover — placeholder shown */ }
  }

  if (!book) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  const hasClubs = clubs.length > 0
  const tags = book.tags || []
  const primaryBtn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 24px', cursor: 'pointer', flex: 1 }
  const secondaryBtn = { ...primaryBtn, color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)' }

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{book.title} — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="join-btn" onClick={() => router.push('/signup')}>Join</button>
          </div>
        </nav>

        <div style={{ paddingBottom: 80 }}>
          <button className="profile-back" onClick={() => router.push('/')}>← Explore</button>

          {/* ── HERO ─────────────────────────────────────────────── */}
          <div style={{ background: 'linear-gradient(160deg, rgba(194,122,90,0.12), rgba(94,122,98,0.08))', borderRadius: 20, padding: '44px 24px', display: 'flex', justifyContent: 'center', margin: '24px 0 28px' }}>
            {coverUrl
              ? <img src={coverUrl} alt={book.title} style={{ width: 150, height: 'auto', borderRadius: 8, boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }} />
              : <div style={{ width: 150, height: 220, borderRadius: 8, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>📖</div>}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 34, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.15, marginBottom: 6 }}>{book.title}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)' }}>{book.author}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, marginTop: 8 }}>{clubs.length} club{clubs.length !== 1 ? 's' : ''} reading this on unscripted</div>
          </div>

          {tags.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
            {tags.slice(0, 5).map(t => <span key={t} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '5px 14px' }}>{t}</span>)}
          </div>}

          {/* ── STAT CARDS ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 420, margin: '0 auto 28px' }}>
            {[['Discussions', threadCount], ['Members reading', memberCount]].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--txD)', marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* ── CTAs ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, maxWidth: 420, margin: '0 auto 40px' }}>
            {hasClubs && <button style={primaryBtn} onClick={() => document.getElementById('clubs-reading')?.scrollIntoView({ behavior: 'smooth' })}>Join a club reading this</button>}
            <button style={hasClubs ? secondaryBtn : primaryBtn} onClick={() => router.push('/signup')}>Start a club for this book</button>
          </div>

          {/* ── BRIDGE (preserved) ───────────────────────────────── */}
          {clubs.length >= 2 && bookKey && <div style={{ background: 'var(--ink)', borderRadius: 14, padding: '20px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
            onClick={() => router.push(`/bridge/book/${encodeURIComponent(bookKey)}`)}>
            <span style={{ fontSize: 22 }}>↗</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: '#F2EBE0' }}>Join the global conversation</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'rgba(242,235,224,0.6)' }}>Readers across {clubs.length} clubs are discussing this book together</div>
            </div>
          </div>}

          {/* ── CLUBS READING THIS ───────────────────────────────── */}
          <div id="clubs-reading" style={{ borderTop: '1px solid var(--bd)', paddingTop: 32 }}>
            <div className="section-title" style={{ marginBottom: 20 }}>Clubs Reading This</div>
            {clubs.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, marginBottom: 12, cursor: 'pointer' }}
                onClick={() => router.push(`/club/${c.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{c.description}</div>
                </div>
                <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 10, color: 'var(--tc)', fontWeight: 600 }}>→</span>
              </div>
            ))}

            {clubs.length === 0 && <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontStyle: 'italic', color: 'var(--txD)', marginBottom: 12 }}>No clubs are reading this yet</div>
              <button style={{ ...primaryBtn, flex: 'none' }} onClick={() => router.push('/signup')}>Be the first — start a club</button>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
