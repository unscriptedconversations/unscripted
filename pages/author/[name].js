import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function AuthorPage() {
  const router = useRouter()
  const rawName = router.query.name
  const name = typeof rawName === 'string' ? rawName : ''

  const [books, setBooks] = useState([])        // on-unscripted, deduped by title
  const [clubs, setClubs] = useState([])        // unique clubs reading this author
  const [readerCount, setReaderCount] = useState(0)
  const [olWorks, setOlWorks] = useState([])    // "more by" from Open Library (not on site)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (router.isReady && name) load() }, [router.isReady, name])

  async function load() {
    setLoading(true)

    // Books on unscripted by this author. Author is stored as free text and
    // may join multiple names ("A, B"), so match by containment.
    const { data: rows } = await supabase
      .from('books')
      .select('id, title, author, club_id, club:clubs(*)')
      .ilike('author', `%${name}%`)

    const bookRows = rows || []

    // Dedupe books by title, collecting every club reading each.
    const byTitle = {}
    for (const b of bookRows) {
      const key = b.title
      if (!byTitle[key]) byTitle[key] = { id: b.id, title: b.title, cover: null, clubs: [] }
      if (b.club) byTitle[key].clubs.push(b.club)
    }
    const deduped = Object.values(byTitle)

    // Unique clubs across all of this author's books.
    const clubMap = {}
    for (const b of bookRows) if (b.club) clubMap[b.club.id] = b.club
    const uniqueClubs = Object.values(clubMap)
    setClubs(uniqueClubs)

    // Reader count across those clubs.
    const clubIds = uniqueClubs.map(c => c.id)
    if (clubIds.length) {
      const { count } = await supabase.from('club_members').select('id', { count: 'exact', head: true }).in('club_id', clubIds)
      setReaderCount(count || 0)
    } else {
      setReaderCount(0)
    }

    // One Open Library call does double duty: covers for on-site titles +
    // a "more by this author" discovery list (works not yet on unscripted).
    let coverByTitle = {}
    let ol = []
    try {
      const r = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(name)}&limit=16&fields=key,title,cover_i,first_publish_year`)
      const d = await r.json()
      const seen = new Set()
      for (const doc of (d.docs || [])) {
        if (!doc.title || seen.has(doc.title.toLowerCase())) continue
        seen.add(doc.title.toLowerCase())
        if (doc.cover_i) coverByTitle[doc.title.toLowerCase()] = doc.cover_i
        ol.push({ key: (doc.key || '').replace('/works/', ''), title: doc.title, cover: doc.cover_i, year: doc.first_publish_year })
      }
    } catch { /* discovery is best-effort */ }

    // Attach covers to on-site titles where we found a match.
    for (const b of deduped) {
      const ci = coverByTitle[b.title.toLowerCase()]
      if (ci) b.cover = ci
    }
    setBooks(deduped)

    // "More by" = OL works this author has that aren't already on unscripted.
    const onSite = new Set(deduped.map(b => b.title.toLowerCase()))
    setOlWorks(ol.filter(w => w.key && !onSite.has(w.title.toLowerCase())).slice(0, 8))

    setLoading(false)
  }

  async function startClub() {
    const q = `bookAuthor=${encodeURIComponent(name)}`
    const { data: { session } } = await supabase.auth.getSession()
    router.push(session ? `/create?${q}` : `/signup?${q}`)
  }

  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const hasBooks = books.length > 0
  const primaryBtn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 24px', cursor: 'pointer', flex: 1 }
  const secondaryBtn = { ...primaryBtn, color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)' }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading…</div></div>

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{name} — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="join-btn" onClick={() => router.push('/signup')}>Join</button>
          </div>
        </nav>

        <div style={{ paddingBottom: 80 }}>
          <button className="profile-back" onClick={() => router.back()}>← Back</button>

          {/* ── HERO ─────────────────────────────────────────────── */}
          <div style={{ background: 'linear-gradient(160deg, rgba(194,122,90,0.12), rgba(94,122,98,0.08))', borderRadius: 20, padding: '44px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', margin: '24px 0 28px' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--ink)', color: '#F2EBE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, fontStyle: 'italic', marginBottom: 18, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}>{initials || '✍'}</div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 34, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.15 }}>{name}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: hasBooks ? 'var(--tc)' : 'var(--txD)', marginTop: 10 }}>
              {hasBooks
                ? [
                    `${books.length} book${books.length !== 1 ? 's' : ''}`,
                    `${clubs.length} club${clubs.length !== 1 ? 's' : ''}`,
                    `${readerCount} reader${readerCount !== 1 ? 's' : ''}`,
                  ].join(' · ')
                : 'Not on unscripted yet'}
            </div>
          </div>

          {/* ── CTAs ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, maxWidth: 420, margin: '0 auto 40px' }}>
            {clubs.length > 0 && <button style={primaryBtn} onClick={() => document.getElementById('author-clubs')?.scrollIntoView({ behavior: 'smooth' })}>See clubs reading {name.split(' ')[0]}</button>}
            <button style={clubs.length > 0 ? secondaryBtn : primaryBtn} onClick={() => startClub()}>Start a club for this author</button>
          </div>

          {/* ── BOOKS ON UNSCRIPTED ───────────────────────────────── */}
          {hasBooks && <div style={{ marginBottom: 36 }}>
            <div className="section-title" style={{ marginBottom: 20 }}>Books on unscripted</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {books.map(b => (
                <div key={b.id} onClick={() => router.push(`/book/${b.id}`)} style={{ cursor: 'pointer' }}>
                  <div style={{ aspectRatio: '2 / 3', borderRadius: 10, overflow: 'hidden', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.14)', marginBottom: 10 }}>
                    {b.cover
                      ? <img src={`https://covers.openlibrary.org/b/id/${b.cover}-M.jpg`} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 34 }}>📖</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.2 }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 3 }}>{b.clubs.length} club{b.clubs.length !== 1 ? 's' : ''} reading</div>
                </div>
              ))}
            </div>
          </div>}

          {/* ── CLUBS READING THIS AUTHOR ─────────────────────────── */}
          {clubs.length > 0 && <div id="author-clubs" style={{ borderTop: '1px solid var(--bd)', paddingTop: 32, marginBottom: 36 }}>
            <div className="section-title" style={{ marginBottom: 20 }}>Clubs Reading {name}</div>
            {clubs.map(c => (
              <div key={c.id} onClick={() => router.push(`/club/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, marginBottom: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{c.description}</div>
                </div>
                <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 10, color: 'var(--tc)', fontWeight: 600 }}>→</span>
              </div>
            ))}
          </div>}

          {/* ── MORE BY (Open Library discovery) ──────────────────── */}
          {olWorks.length > 0 && <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 32 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>More by {name}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 20 }}>Not on unscripted yet — open one to start a club.</div>
            {olWorks.map(w => (
              <div key={w.key} onClick={() => router.push(`/book/${w.key}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}>
                {w.cover
                  ? <img src={`https://covers.openlibrary.org/b/id/${w.cover}-S.jpg`} alt="" style={{ width: 34, height: 50, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  : <span style={{ fontSize: 24, width: 34, textAlign: 'center' }}>📖</span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{w.title}</div>
                  {w.year && <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>First published {w.year}</div>}
                </div>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--txD)', flexShrink: 0 }}>Not on unscripted</span>
              </div>
            ))}
          </div>}

          {/* ── EMPTY ─────────────────────────────────────────────── */}
          {!hasBooks && olWorks.length === 0 && <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontStyle: 'italic', color: 'var(--txD)', marginBottom: 8 }}>Nothing here yet</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 16px' }}>No clubs on unscripted are reading {name} yet. Be the first to open their work up for conversation.</div>
            <button style={{ ...primaryBtn, flex: 'none' }} onClick={() => startClub()}>Start a club for this author</button>
          </div>}
        </div>
      </div>
    </div>
  )
}
