import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

function initialsFor(m) {
  if (m?.initials) return m.initials
  const f = (m?.first_name || '')[0] || ''
  const l = (m?.last_name || '')[0] || ''
  return (f + l).toUpperCase() || '?'
}
function Avatar({ member, size = 32 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{initialsFor(member)}</div>
}

// Author name(s) as links to the author page. stopPropagation so tapping the
// name doesn't also trigger the row's navigation to the book.
function AuthorLinks({ author, router }) {
  if (!author) return null
  const parts = author.split(',').map(s => s.trim()).filter(Boolean)
  return parts.map((nm, i) => (
    <span key={i}>
      <span onClick={(e) => { e.stopPropagation(); router.push(`/author/${encodeURIComponent(nm)}`) }} style={{ color: 'var(--tc)', cursor: 'pointer' }}>{nm}</span>{i < parts.length - 1 ? ', ' : ''}
    </span>
  ))
}

const FORMAT_LABEL = { essay: 'Essay', reflection: 'Reflection', note: 'Note' }
const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', margin: '28px 0 12px' }}>{children}</div>
)

export default function SearchPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [clubs, setClubs] = useState([])
  const [books, setBooks] = useState([])
  const [writings, setWritings] = useState([])
  const [authors, setAuthors] = useState([])
  const [bridges, setBridges] = useState([])
  const [olBooks, setOlBooks] = useState([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(false)
  const [olLoading, setOlLoading] = useState(false)
  const [ran, setRan] = useState(false)

  // Seed from ?q= (homepage "see all results" passes it through)
  useEffect(() => {
    if (!router.isReady) return
    const initial = typeof router.query.q === 'string' ? router.query.q : ''
    if (initial) { setQ(initial); runSearch(initial) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  async function runSearch(val) {
    const term = (val ?? q).trim()
    if (term.length < 2) return
    setLoading(true); setRan(true)
    const lv = term.toLowerCase()
    const like = `%${term}%`

    const [cR, bR, wR, aR, brR] = await Promise.all([
      supabase.from('clubs').select('id, name, description, privacy, tagline, tags').or(`name.ilike.${like},description.ilike.${like},tagline.ilike.${like},tags.cs.{${term}}`).limit(20),
      supabase.from('books').select('id, title, author, tags, club:clubs(name)').or(`title.ilike.${like},author.ilike.${like},tags.cs.{${term}}`).limit(20),
      supabase.from('writings').select('id, title, content, format, published_at, member_id, tags, author:members(id, first_name, last_name, initials, color)').eq('is_published', true).or(`title.ilike.${like},content.ilike.${like},tags.cs.{${term}}`).limit(20),
      supabase.from('members').select('id, first_name, last_name, initials, color').or('status.is.null,status.neq.disabled').or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(12),
      supabase.from('bridge_threads').select('*').or(`title.ilike.${like},anchor.ilike.${like}`).limit(12),
    ])
    setClubs(cR.data || [])
    setBooks(bR.data || [])
    setWritings(wR.data || [])
    setAuthors(aR.data || [])

    // Bridge threads → attach reader/post counts (one pass over their posts)
    const brThreads = brR.data || []
    if (brThreads.length) {
      const ids = brThreads.map(t => t.id)
      const { data: ps } = await supabase.from('bridge_posts').select('thread_id, member_id, club_id').in('thread_id', ids)
      const st = {}
      for (const p of (ps || [])) {
        const s = st[p.thread_id] || (st[p.thread_id] = { m: new Set(), c: new Set(), n: 0 })
        if (p.member_id) s.m.add(p.member_id)
        if (p.club_id) s.c.add(p.club_id)
        s.n++
      }
      setBridges(brThreads.map(t => { const s = st[t.id] || { m: new Set(), c: new Set(), n: 0 }; return { ...t, readers: s.m.size, clubs: s.c.size, postCount: s.n } }))
    } else {
      setBridges([])
    }
    setLoading(false)

    // Wider catalog (Open Library), deduped against on-platform titles
    setOlLoading(true)
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year`)
      const d = await r.json()
      const onSite = new Set((bR.data || []).map(b => b.title.toLowerCase()))
      setOlBooks((d.docs || [])
        .filter(doc => doc.title && doc.key)
        .map(doc => ({ key: doc.key.replace('/works/', ''), title: doc.title, author: (doc.author_name || []).join(', '), cover: doc.cover_i, year: doc.first_publish_year }))
        .filter(b => !onSite.has(b.title.toLowerCase()))
        .slice(0, 8))
    } catch { setOlBooks([]) }
    setOlLoading(false)
  }

  function submit(e) { e?.preventDefault?.(); runSearch() }

  const show = t => tab === 'all' || tab === t
  const totalOnSite = clubs.length + books.length + writings.length + authors.length + bridges.length + olBooks.length
  const preview = t => (t || '').length > 160 ? t.slice(0, 160) + '…' : t

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 10, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Search — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="nav-btn" onClick={() => router.push('/writing')}>Writing</button>
          </div>
        </nav>

        <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>
          <form onSubmit={submit} style={{ position: 'relative', margin: '40px 0 8px' }}>
            <input
              autoFocus
              className="field-input"
              style={{ marginBottom: 0, paddingLeft: 48, borderRadius: 14, fontSize: 16 }}
              placeholder="Search books, clubs, writing, a theme…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>
          </form>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 8px' }}>
            {[['all', 'All'], ['books', 'Books'], ['clubs', 'Clubs'], ['writings', 'Writing'], ['bridges', 'Bridge'], ['authors', 'Authors']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: tab === k ? 'var(--tc)' : 'var(--txD)', background: tab === k ? 'var(--tcD)' : 'transparent', border: '1px solid ' + (tab === k ? 'var(--tc)' : 'var(--bd)'), borderRadius: 100, padding: '7px 16px', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>

          {loading && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Searching…</div>}

          {ran && !loading && totalOnSite === 0 && !olLoading && (
            <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontStyle: 'italic', color: 'var(--txD)', padding: '40px 0', textAlign: 'center' }}>No results for “{q}”.</div>
          )}

          {/* CLUBS */}
          {show('clubs') && clubs.length > 0 && <div>
            <SectionLabel>Clubs</SectionLabel>
            {clubs.map(c => (
              <div key={c.id} style={rowStyle} onClick={() => router.push(`/club/${c.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{c.description}</div>
                  {(c.tags || []).length > 0 && <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>{c.tags.slice(0, 3).map(t => <span key={t} style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 600, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '2px 8px' }}>{t}</span>)}</div>}
                </div>
                <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
              </div>
            ))}
          </div>}

          {/* BOOKS ON UNSCRIPTED */}
          {show('books') && books.length > 0 && <div>
            <SectionLabel>Books on unscripted</SectionLabel>
            {books.map(b => (
              <div key={b.id} style={rowStyle} onClick={() => router.push(`/book/${b.id}`)}>
                <span style={{ fontSize: 22 }}>📖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}><AuthorLinks author={b.author} router={router} />{b.club ? ` · ${b.club.name}` : ''}</div>
                </div>
              </div>
            ))}
          </div>}

          {/* WRITINGS */}
          {show('writings') && writings.length > 0 && <div>
            <SectionLabel>Writing</SectionLabel>
            {writings.map(w => (
              <div key={w.id} style={{ ...rowStyle, alignItems: 'flex-start' }} onClick={() => router.push(`/writing/${w.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>{FORMAT_LABEL[w.format] || 'Note'}</span>
                    {w.author && <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{w.author.first_name} {w.author.last_name}</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 4 }}>{w.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.55 }}>{preview(w.content)}</div>
                </div>
              </div>
            ))}
          </div>}

          {/* AUTHORS */}
          {show('authors') && authors.length > 0 && <div>
            <SectionLabel>People</SectionLabel>
            {authors.map(a => (
              <div key={a.id} style={rowStyle} onClick={() => router.push(`/profile/${a.id}`)}>
                <Avatar member={a} size={36} />
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.first_name} {a.last_name}</div>
              </div>
            ))}
          </div>}

          {/* BRIDGE CONVERSATIONS */}
          {show('bridges') && bridges.length > 0 && <div>
            <SectionLabel>Conversations</SectionLabel>
            {bridges.map(t => (
              <div key={t.id} style={rowStyle} onClick={() => t.kind === 'book' ? router.push(`/bridge/book/${encodeURIComponent(t.title)}${t.subtitle ? `?author=${encodeURIComponent(t.subtitle)}` : ''}`) : router.push(`/bridge/theme/${encodeURIComponent(t.title || t.anchor)}`)}>
                <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>{t.kind === 'book' ? '📖' : '◆'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: t.kind === 'book' ? 'italic' : 'normal', color: 'var(--ink)' }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 2 }}>{[t.clubs > 0 && `${t.clubs} club${t.clubs !== 1 ? 's' : ''}`, `${t.readers} reader${t.readers !== 1 ? 's' : ''}`, `${t.postCount} post${t.postCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>}

          {/* WIDER CATALOG */}
          {show('books') && (olLoading || olBooks.length > 0) && <div>
            <SectionLabel>All books</SectionLabel>
            {olLoading && olBooks.length === 0 && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', padding: '4px 4px 12px' }}>Searching the wider catalog…</div>}
            {olBooks.map(b => (
              <div key={b.key} style={rowStyle} onClick={() => router.push(`/book/${b.key}`)}>
                {b.cover
                  ? <img src={`https://covers.openlibrary.org/b/id/${b.cover}-S.jpg`} alt="" style={{ width: 30, height: 46, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                  : <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>📖</span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}><AuthorLinks author={b.author} router={router} />{b.year ? ` · ${b.year}` : ''}</div>
                </div>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--txD)', flexShrink: 0 }}>Not on unscripted</span>
              </div>
            ))}
          </div>}

          {!ran && (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', padding: '40px 0', textAlign: 'center', lineHeight: 1.7 }}>
              Search across books, clubs, writing, and people.<br />Try a title, an author, or a theme like “grief” or “identity.”
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
