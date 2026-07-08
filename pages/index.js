import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Landing() {
  const router = useRouter()
  const [clubs, setClubs] = useState([])
  const [books, setBooks] = useState([])
  const [q, setQ] = useState('')
  const [sr, setSR] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()

    // Load session from Supabase Auth (replaces localStorage)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: member } = await supabase
        .from('members').select('*').eq('id', session.user.id).single()
      if (member) setCurrentUser(member)
    })

    // Keep in sync on login/logout/OAuth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data: member } = await supabase
          .from('members').select('*').eq('id', session.user.id).single()
        if (member) setCurrentUser(member)
      } else {
        setCurrentUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadData() {
    const [cR, bR] = await Promise.all([
      supabase.from('clubs').select('*, club_members(count), books(title, author, status)'),
      supabase.from('books').select('*, club:clubs(name)').order('created_at', { ascending: false }),
    ])
    if (cR.data) setClubs(cR.data)
    if (bR.data) setBooks(bR.data)
    setLoading(false)
  }

  function doSearch(val) {
    setQ(val)
    if (val.length < 2) { setSR(null); return }
    const lv = val.toLowerCase()
    const clubHits = clubs.filter(c => c.name.toLowerCase().includes(lv))
    const bookHits = books.filter(b => b.title.toLowerCase().includes(lv))
    setSR({ clubs: clubHits, books: bookHits })
  }

  function getClubMemberCount(c) {
    return c.club_members?.[0]?.count || 0
  }

  function getClubCurrentBook(c) {
    const b = (c.books || []).find(b => b.status === 'current')
    return b || (c.books || [])[0]
  }

  const featuredClubs = clubs.filter(c => c.featured)
  // Fallback: if no featured clubs, show top 3 by member count
  const featuredDisplay = featuredClubs.length > 0
    ? featuredClubs.slice(0, 3)
    : [...clubs].sort((a, b) => getClubMemberCount(b) - getClubMemberCount(a)).slice(0, 3)
  const uniqueBooks = [...new Map(books.map(b => [b.title, b])).values()].slice(0, 6)

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>unscripted — every reader deserves a room</title>
      <div className="shell">

        {/* NAV */}
        <nav className="topnav">
          <div className="brand"><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn active">Explore</button>
            {currentUser ? (
              <div className="user-nav" onClick={async () => {
                const { data: ms } = await supabase.from('club_members').select('club_id')
                  .eq('member_id', currentUser.id).order('joined_at', { ascending: true }).limit(1).single()
                router.push(ms?.club_id ? `/club/${ms.club_id}` : '/')
              }}>
                <span className="user-nav-name">{currentUser.first_name}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => router.push('/login')}>Log in</span>
                <button className="join-btn" onClick={() => router.push('/signup')}>Join</button>
              </div>
            )}
          </div>
        </nav>

        {/* HERO + SEARCH */}
        <section style={{ padding: '60px 0 48px', textAlign: 'center' }}>
          <h1 className="hero-h1" style={{ textAlign: 'center' }}>Every reader<br />deserves a <em>room.</em></h1>
          <p style={{ fontFamily: 'var(--ui)', fontSize: 16, lineHeight: 1.7, color: 'var(--txD)', maxWidth: 520, margin: '0 auto 36px' }}>
            Find your book club. Start your own. Join the conversation that changes how you think.
          </p>

          <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
            <input
              className="field-input"
              style={{ marginBottom: 0, paddingLeft: 48, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', borderRadius: 14, fontSize: 15 }}
              placeholder="Search by club name or book title..."
              value={q}
              onChange={e => doSearch(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>

            {sr && <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 400, overflowY: 'auto' }}>
              {sr.clubs.length === 0 && sr.books.length === 0 && (
                <div style={{ padding: 24, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', textAlign: 'center' }}>No results for "{q}"</div>
              )}
              {sr.clubs.length > 0 && <div>
                <div style={{ padding: '12px 24px 8px', fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)' }}>Clubs</div>
                {sr.clubs.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}
                    onClick={() => router.push(`/club/${c.id}`)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{getClubMemberCount(c)} members</div>
                    </div>
                    <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
                  </div>
                ))}
              </div>}
              {sr.books.length > 0 && <div>
                <div style={{ padding: '12px 24px 8px', fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)' }}>Books</div>
                {sr.books.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}
                    onClick={() => router.push(`/book/${b.id}`)}>
                    <span style={{ fontSize: 20 }}>📖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{b.title}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}{b.club ? ` · ${b.club.name}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>}
          </div>
        </section>

        {/* SPOTLIGHT */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 20 }}>✦ Spotlight</div>
          <div style={{ background: 'var(--ink)', borderRadius: 20, padding: '40px 48px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--tc), var(--sg))' }} />
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 16 }}>Book of the Month</div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#F2EBE0', lineHeight: 1.15, marginBottom: 8 }}>I Who Have Never Known Men</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'rgba(242,235,224,0.5)', marginBottom: 20 }}>Jacqueline Harpman</div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', lineHeight: 1.7, color: 'rgba(242,235,224,0.6)', marginBottom: 24, maxWidth: 600 }}>
              Forty women locked in an underground cage. No memory of why. When the guards vanish, they walk into an empty earth — and the youngest among them becomes their guide.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="join-btn" style={{ background: 'var(--tc)', color: 'var(--ink)' }}>Find a club reading this</button>
              <button className="join-btn" style={{ background: 'none', border: '1.5px solid rgba(242,235,224,0.2)', color: '#F2EBE0' }} onClick={() => router.push('/signup')}>Start your own</button>
            </div>
          </div>
        </section>

        {/* AD BANNER */}
        <a href="https://thelitbar.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '24px 32px', marginBottom: 48, display: 'flex', alignItems: 'center', gap: 24, cursor: 'pointer' }}>
            <div style={{ width: 80, height: 80, borderRadius: 12, background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>📚</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 6 }}>Sponsored</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>The Lit Bar — Bronx, NY</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.5 }}>The Bronx's only indie bookstore. 10% off for unscripted members.</div>
            </div>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', flexShrink: 0 }}>Visit ↗</span>
          </div>
        </a>

        {/* FEATURED CLUBS */}
        {!loading && featuredDisplay.length > 0 && <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="section-title">{featuredClubs.length > 0 ? 'Featured Clubs' : 'Active Clubs'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {featuredDisplay.map(c => {
              const cb = getClubCurrentBook(c)
              return (
                <div key={c.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 16, padding: 24, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => router.push(`/club/${c.id}`)}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--tc), var(--sg))' }} />
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 16, lineHeight: 1.5 }}>{c.description}</div>
                  {cb && <div style={{ background: 'linear-gradient(145deg,#A85A3A,#C27A5A 40%,#D4956A)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--ui)', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Reading</div>
                    <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontWeight: 600, fontStyle: 'italic', color: '#FFF' }}>{cb.title}</div>
                  </div>}
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{getClubMemberCount(c)} members</div>
                </div>
              )
            })}
          </div>
        </section>}

        {/* TRENDING BOOKS */}
        {!loading && <section style={{ marginBottom: 48 }}>
          <div className="section-title" style={{ marginBottom: 20 }}>Trending on Unscripted</div>
          {uniqueBooks.length > 0 ? (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {uniqueBooks.map(b => (
                <div key={b.id} style={{ minWidth: 180, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 18px', flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => router.push(`/book/${b.id}`)}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.25, marginBottom: 6 }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14 }}>
              {['Literary Fiction', 'Memoir', 'Speculative Fiction'].map(genre => (
                <div key={genre} style={{ minWidth: 180, background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '20px 18px', flexShrink: 0, opacity: 0.5 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 8 }}>{genre}</div>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontStyle: 'italic', color: 'var(--txD)', lineHeight: 1.4 }}>Start a club to see what the community is reading</div>
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* ALL CLUBS + SIDEBAR ADS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, marginBottom: 48 }}>
          <div>
            <div className="section-title" style={{ marginBottom: 20 }}>All Clubs</div>
            {loading && (
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Loading clubs…</div>
            )}
            {!loading && clubs.length === 0 && (
              <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  No clubs yet.
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 24 }}>
                  Be the first to start a reading community on unscripted.
                </div>
                <button
                  onClick={() => router.push('/signup')}
                  style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer' }}
                >
                  Start the first club
                </button>
              </div>
            )}
            {!loading && clubs.map(c => {
              const cb = getClubCurrentBook(c)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 10, cursor: 'pointer' }}
                  onClick={() => router.push(`/club/${c.id}`)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                    <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{cb ? cb.title + ' · ' : ''}{getClubMemberCount(c)} members</div>
                  </div>
                  <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
                </div>
              )
            })}
          </div>
          <div>
            {[
              { t: 'Strand Bookstore', d: '18 miles of books since 1927.', url: 'https://strandbooks.com' },
              { t: 'Audible', d: 'Listen to your club\'s current read. First month free.', url: 'https://audible.com' },
            ].map((ad, i) => (
              <a key={i} href={ad.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: 24, marginBottom: 16, cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10 }}>Sponsored</div>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{ad.t}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.5, marginBottom: 12 }}>{ad.d}</div>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>Visit ↗</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{ borderTop: '1px solid var(--bd)', padding: '32px 0 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--cs)', fontSize: 20, color: 'var(--ink)' }}>unscripted</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>A bridger of community. Have an opinion.</div>
        </footer>
      </div>
    </div>
  )
}
