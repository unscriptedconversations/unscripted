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

  useEffect(() => { if (id) loadBook() }, [id])

  async function loadBook() {
    const { data: b } = await supabase.from('books').select('*').eq('id', id).single()
    if (b) {
      setBook(b)
      setBookKey(b.book_key)
      const { data: allBooks } = await supabase.from('books').select('*, club:clubs(*)').eq('title', b.title)
      if (allBooks) setClubs(allBooks.map(ab => ab.club).filter(Boolean))
    }
  }

  if (!book) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

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
          <div style={{ padding: '40px 0 32px' }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 38, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8 }}>{book.title}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 16, color: 'var(--txD)', marginBottom: 24 }}>{book.author}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--tc)', fontWeight: 600 }}>{clubs.length} club{clubs.length !== 1 ? 's' : ''} reading this on unscripted</div>
          </div>

          {clubs.length >= 2 && bookKey && <div style={{ background: 'var(--ink)', borderRadius: 14, padding: '20px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
            onClick={() => router.push(`/bridge/book/${encodeURIComponent(bookKey)}`)}>
            <span style={{ fontSize: 22 }}>↗</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: '#F2EBE0' }}>Join the global conversation</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'rgba(242,235,224,0.6)' }}>Readers across {clubs.length} clubs are discussing this book together</div>
            </div>
          </div>}

          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 32 }}>
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
            </div>}

            <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '24px 20px', textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontStyle: 'italic', color: 'var(--txD)', marginBottom: 12 }}>Want to read this with your own group?</div>
              <button className="join-btn" onClick={() => router.push('/signup')}>Start a club for this book</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
