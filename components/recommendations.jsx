// components/Recommendations.jsx
// "Recommended for you" rail for the homepage.
// Self-contained: resolves its own session, loads the signals, calls the pure
// scoring in lib/recommend, and renders nothing when logged out or when there's
// nothing worth showing (no layout jank). Mounting is a one-line drop-in.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { recommendBooks, recommendClubs } from '../lib/recommend'

const norm = (s) => (s == null ? '' : String(s).trim().toLowerCase())

export default function Recommendations() {
  const router = useRouter()
  const [books, setBooks] = useState([])
  const [clubs, setClubs] = useState([])
  const [mode, setMode] = useState('personalized') // 'personalized' | 'coldstart'
  const [ready, setReady] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setReady(true); return } // logged out → render nothing

    const { data: me } = await supabase
      .from('members')
      .select('id, member_interests')
      .eq('auth_id', session.user.id)
      .maybeSingle()
    if (!me) { setReady(true); return }

    // Pull signals + candidate pools in parallel.
    const [myClubsRes, shelfRes, booksRes, clubsRes] = await Promise.all([
      supabase.from('club_members').select('club_id, clubs(id, tags)').eq('member_id', me.id),
      supabase.from('shelves').select('title, author, status').eq('member_id', me.id),
      supabase.from('books').select('id, title, author, tags, club_id'),
      supabase.from('clubs').select('id, name, tags, privacy, club_members(count)'),
    ])

    const myClubRows = myClubsRes.data || []
    const myClubIds = myClubRows.map((r) => r.club_id)
    const clubTags = myClubRows.flatMap((r) => (r.clubs?.tags) || [])

    // Tags don't live on the shelf row — derive them from the books pool by title.
    const allBooks = booksRes.data || []
    const tagsByTitle = new Map()
    for (const b of allBooks) {
      const k = norm(b.title)
      if (!tagsByTitle.has(k) || (b.tags?.length || 0) > (tagsByTitle.get(k)?.length || 0)) {
        tagsByTitle.set(k, b.tags || [])
      }
    }

    const shelved = (shelfRes.data || []).map((s) => ({
      title: s.title,
      author: s.author,
      status: s.status,
      tags: tagsByTitle.get(norm(s.title)) || [],
    }))

    const signals = { interests: me.member_interests || [], clubTags, shelved }

    // Book candidates: dedupe the books table by title, keep the richest-tagged row.
    const byTitle = new Map()
    for (const b of allBooks) {
      const k = norm(b.title)
      const cur = byTitle.get(k)
      if (!cur || (b.tags?.length || 0) > (cur.tags?.length || 0)) byTitle.set(k, b)
    }
    const bookCandidates = [...byTitle.values()]

    const clubCandidates = (clubsRes.data || []).map((c) => ({
      ...c,
      memberCount: c.club_members?.[0]?.count ?? 0,
    }))

    // Cold-start fallbacks so a brand-new user still sees something.
    const fallbackClubs = [...clubCandidates].sort((a, b) => b.memberCount - a.memberCount)
    const fallbackBooks = [...bookCandidates].slice(0, 6)

    const bRec = recommendBooks(signals, { candidates: bookCandidates, limit: 6, fallbackBooks })
    const cRec = recommendClubs(signals, {
      candidates: clubCandidates, limit: 4, fallbackClubs, myClubIds, openOnly: true,
    })

    setBooks(bRec.items || [])
    setClubs(cRec.items || [])
    setMode(bRec.mode === 'coldstart' && cRec.mode === 'coldstart' ? 'coldstart' : 'personalized')
    setReady(true)
  }

  if (!ready || (books.length === 0 && clubs.length === 0)) return null

  const heading = mode === 'coldstart' ? 'Popular right now' : 'Recommended for you'
  const sub =
    mode === 'coldstart'
      ? 'A few places to start.'
      : 'Picked from your interests, shelves, and clubs.'

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '8px 24px 44px' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          {heading}
        </h2>
        <p style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', margin: '4px 0 0' }}>{sub}</p>
      </div>

      {books.length > 0 && (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, marginBottom: clubs.length ? 30 : 0 }}>
          {books.map((b) => (
            <BookCard key={b.id} book={b} onClick={() => router.push(`/book/${b.id}`)} />
          ))}
        </div>
      )}

      {clubs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {clubs.map((c) => (
            <ClubCard key={c.id} club={c} onClick={() => router.push(`/club/${c.id}`)} />
          ))}
        </div>
      )}
    </section>
  )
}

function reasonText(why) {
  if (!why) return null
  if (why.author) return `Because you read ${why.author}`
  if (why.tags && why.tags.length) return `Because you're into ${why.tags[0]}`
  return null
}

function BookCard({ book, onClick }) {
  const reason = reasonText(book.why)
  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto', width: 200, textAlign: 'left', cursor: 'pointer',
        background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ fontFamily: 'var(--hd)', fontSize: 19, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
        {book.title}
      </div>
      <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{book.author}</div>
      {book.tags?.[0] && (
        <span style={{
          alignSelf: 'flex-start', fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tc)', background: 'var(--tcD)',
          borderRadius: 100, padding: '4px 10px',
        }}>
          {book.tags[0]}
        </span>
      )}
      {reason && (
        <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txM)', marginTop: 'auto' }}>{reason}</div>
      )}
    </button>
  )
}

function ClubCard({ club, onClick }) {
  const reason = reasonText(club.why)
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', background: 'var(--sf)', border: '1px solid var(--bd)',
        borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ fontFamily: 'var(--hd)', fontSize: 21, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.15 }}>
        {club.name}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(club.tags || []).slice(0, 2).map((t) => (
          <span key={t} style={{
            fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '4px 10px',
          }}>
            {t}
          </span>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txM)', marginTop: 'auto' }}>
        {reason || `${club.memberCount || 0} member${club.memberCount === 1 ? '' : 's'}`}
      </div>
    </button>
  )
}
