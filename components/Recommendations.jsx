// components/Recommendations.jsx
// "Recommended for you" rail for the homepage.
// Self-contained: resolves its own session, loads the signals, calls the pure
// scoring in lib/recommend, and renders nothing when logged out or when there's
// nothing worth showing (no layout jank).
//
// v2: after the heuristic pass, it asks /api/recommend to re-rank + add a
// one-line blurb per pick. That call is STRICTLY OPTIONAL — if the route is
// disabled (no API key), errors, or is slow (>6s), the rail falls back to the
// heuristic order with no blurbs. Nothing here can break the working v1 rail.
//
// v2.1 (this session):
//  - Dismiss: a × on each card writes to recommendation_feedback and hides the
//    item. Dismissed items are excluded from the candidate pools on load (before
//    scoring), so the limit backfills with fresh picks and they never re-show.
//    Books are keyed by NORMALIZED TITLE (the internal books table has no stable
//    book_key, and the same title appears as different rows across clubs);
//    clubs are keyed by id. Both are just text in item_key.
//  - Covers: each book card has a fixed cover zone with a tinted placeholder,
//    filled in the background from Open Library. Fully optional — a failed or
//    missing cover just leaves the placeholder. Never blocks the rail.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { recommendBooks, recommendClubs } from '../lib/recommend'

const norm = (s) => (s == null ? '' : String(s).trim().toLowerCase())

// Module-level cover cache so navigating back to the homepage within a session
// doesn't re-hit Open Library for titles we've already resolved.
const coverCache = new Map() // norm(title) -> coverUrl | null

export default function Recommendations() {
  const router = useRouter()
  const [memberId, setMemberId] = useState(null)
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
    setMemberId(me.id)

    // Pull signals + candidate pools + prior feedback in parallel.
    const [myClubsRes, shelfRes, booksRes, clubsRes, fbRes] = await Promise.all([
      supabase.from('club_members').select('club_id, clubs(id, tags)').eq('member_id', me.id),
      supabase.from('shelves').select('title, author, status').eq('member_id', me.id),
      supabase.from('books').select('id, title, author, tags, club_id'),
      supabase.from('clubs').select('id, name, tags, privacy, club_members(count)'),
      supabase.from('recommendation_feedback').select('item_type, item_key').eq('member_id', me.id),
    ])

    // What the user has already dismissed / marked not-interested.
    const fb = fbRes.data || []
    const dismissedBooks = new Set(fb.filter((f) => f.item_type === 'book').map((f) => f.item_key))
    const dismissedClubs = new Set(fb.filter((f) => f.item_type === 'club').map((f) => f.item_key))

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

    // Book candidates: dedupe the books table by title, keep the richest-tagged
    // row, then drop anything the user has dismissed (keyed by normalized title).
    const byTitle = new Map()
    for (const b of allBooks) {
      const k = norm(b.title)
      const cur = byTitle.get(k)
      if (!cur || (b.tags?.length || 0) > (cur.tags?.length || 0)) byTitle.set(k, b)
    }
    const bookCandidates = [...byTitle.values()].filter((b) => !dismissedBooks.has(norm(b.title)))

    const clubCandidates = (clubsRes.data || [])
      .map((c) => ({ ...c, memberCount: c.club_members?.[0]?.count ?? 0 }))
      .filter((c) => !dismissedClubs.has(String(c.id)))

    // Cold-start fallbacks so a brand-new user still sees something.
    const fallbackClubs = [...clubCandidates].sort((a, b) => b.memberCount - a.memberCount)
    const fallbackBooks = [...bookCandidates].slice(0, 6)

    const bRec = recommendBooks(signals, { candidates: bookCandidates, limit: 6, fallbackBooks })
    const cRec = recommendClubs(signals, {
      candidates: clubCandidates, limit: 4, fallbackClubs, myClubIds, openOnly: true,
    })

    let finalBooks = bRec.items || []
    let finalClubs = cRec.items || []

    // Optional LLM enrichment — only worth trying on personalized results.
    if (bRec.mode === 'personalized' || cRec.mode === 'personalized') {
      const enriched = await enrich(signals.interests, finalBooks, finalClubs)
      if (enriched) { finalBooks = enriched.books; finalClubs = enriched.clubs }
    }

    setBooks(finalBooks)
    setClubs(finalClubs)
    setMode(bRec.mode === 'coldstart' && cRec.mode === 'coldstart' ? 'coldstart' : 'personalized')
    setReady(true)

    // Fire-and-forget: fill in cover images after the rail is already on screen.
    resolveCovers(finalBooks)
  }

  // Resolve Open Library covers in the background and merge them in by id.
  // Non-blocking and best-effort: any miss just leaves the placeholder.
  async function resolveCovers(list) {
    const results = await Promise.all(
      list.map(async (b) => {
        const key = norm(b.title)
        if (coverCache.has(key)) {
          const cached = coverCache.get(key)
          return cached ? { id: b.id, coverUrl: cached } : null
        }
        try {
          const q = new URLSearchParams({ title: b.title, limit: '1', fields: 'cover_i' })
          if (b.author) q.set('author', b.author)
          const r = await fetch(`https://openlibrary.org/search.json?${q.toString()}`)
          if (!r.ok) { coverCache.set(key, null); return null }
          const j = await r.json()
          const cid = j?.docs?.[0]?.cover_i
          const url = cid ? `https://covers.openlibrary.org/b/id/${cid}-M.jpg` : null
          coverCache.set(key, url)
          return url ? { id: b.id, coverUrl: url } : null
        } catch {
          coverCache.set(key, null)
          return null
        }
      })
    )
    const map = new Map(results.filter(Boolean).map((x) => [x.id, x.coverUrl]))
    if (map.size) {
      setBooks((prev) => prev.map((b) => (map.has(b.id) ? { ...b, coverUrl: map.get(b.id) } : b)))
    }
  }

  async function dismiss(itemType, itemKey, matcher) {
    if (!memberId) return
    // Optimistic hide.
    if (itemType === 'book') setBooks((prev) => prev.filter((b) => !matcher(b)))
    else setClubs((prev) => prev.filter((c) => !matcher(c)))
    // Persist (upsert so re-dismissing is idempotent).
    await supabase.from('recommendation_feedback').upsert(
      { member_id: memberId, item_type: itemType, item_key: itemKey, action: 'dismiss' },
      { onConflict: 'member_id,item_type,item_key' }
    )
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
            <BookCard
              key={b.id}
              book={b}
              onClick={() => router.push(`/book/${b.id}`)}
              onDismiss={() => dismiss('book', norm(b.title), (x) => norm(x.title) === norm(b.title))}
            />
          ))}
        </div>
      )}

      {clubs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {clubs.map((c) => (
            <ClubCard
              key={c.id}
              club={c}
              onClick={() => router.push(`/club/${c.id}`)}
              onDismiss={() => dismiss('club', String(c.id), (x) => String(x.id) === String(c.id))}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// Ask the server route to curate + write blurbs. Returns null on disabled /
// error / timeout / empty so the caller keeps the heuristic order untouched.
async function enrich(interests, books, clubs) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        interests,
        books: books.map((b) => ({ id: b.id, title: b.title, author: b.author, tags: b.tags })),
        clubs: clubs.map((c) => ({ id: c.id, name: c.name, tags: c.tags })),
      }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    if (data.disabled) return null

    // Apply the model's order + blurbs, but only for ids we sent. If it returns
    // nothing usable for a list, that list stays in its heuristic order.
    const merge = (ret, source) => {
      if (!Array.isArray(ret) || ret.length === 0) return source
      const byId = new Map(source.map((x) => [String(x.id), x]))
      const out = []
      for (const r of ret) {
        const item = byId.get(String(r.id))
        if (item) out.push({ ...item, blurb: r.blurb })
      }
      return out.length ? out : source
    }

    return { books: merge(data.books, books), clubs: merge(data.clubs, clubs) }
  } catch {
    return null
  }
}

function reasonText(why) {
  if (!why) return null
  if (why.author) return `Because you read ${why.author}`
  if (why.tags && why.tags.length) return `Because you're into ${why.tags[0]}`
  return null
}

// Small circular × control. A <span>, not a <button>, so it can live inside the
// card button without nesting interactive elements. Stops propagation so a
// dismiss never triggers navigation.
function DismissX({ onDismiss }) {
  const stop = (e) => { e.stopPropagation() }
  return (
    <span
      role="button"
      aria-label="Not interested"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onDismiss() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDismiss() } }}
      onMouseDown={stop}
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 2,
        width: 24, height: 24, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(26,31,46,0.55)', color: '#fff',
        fontSize: 14, lineHeight: 1, cursor: 'pointer',
      }}
    >
      ×
    </span>
  )
}

function BookCard({ book, onClick, onDismiss }) {
  const reason = book.blurb || reasonText(book.why)
  const [imgOk, setImgOk] = useState(true)
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        flex: '0 0 auto', width: 200, textAlign: 'left', cursor: 'pointer',
        background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <DismissX onDismiss={onDismiss} />

      {/* Fixed cover zone: tinted placeholder always present; image overlays when resolved. */}
      <div style={{
        position: 'relative', width: '100%', height: 150, borderRadius: 10, overflow: 'hidden',
        background: 'var(--tcD)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--tc)',
          textAlign: 'center', padding: '0 12px', lineHeight: 1.25,
        }}>
          {book.title}
        </span>
        {book.coverUrl && imgOk && (
          <img
            src={book.coverUrl}
            alt=""
            onError={() => setImgOk(false)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

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

function ClubCard({ club, onClick, onDismiss }) {
  const reason = club.blurb || reasonText(club.why)
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left', cursor: 'pointer', background: 'var(--sf)', border: '1px solid var(--bd)',
        borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <DismissX onDismiss={onDismiss} />
      <div style={{ fontFamily: 'var(--hd)', fontSize: 21, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.15, paddingRight: 22 }}>
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
