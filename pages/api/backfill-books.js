// pages/api/backfill-books.js
// One-time cleanup of books saved before Open Library IDs were stored.
// Admin only: the caller's login email must equal the ADMIN_EMAIL env var.
//
// POST { mode: 'preview' }            -> proposed changes, nothing written
// POST { mode: 'apply', ids: [...] }  -> recomputes those books and applies
//                                        only what the server itself proposes
//
// For each saved book:
//   - no book_key  -> look it up on Open Library by title + author; attach the
//                     work ID only when the author matches (or none was saved)
//   - has book_key -> look it up by that ID
// Fallbacks when the title search finds nothing: reuse the ID of another saved
// copy with the same title, then a broader search (title + first author's last
// name across all editions, so English titles of translated books match).
// Rename to the English edition title only when the saved title is the work's
// original-language title (e.g. "Moi qui n'ai pas connu les hommes"). Titles a
// host typed differently are left alone. The book's "Open Discussion: <title>"
// thread is renamed with it.

import { createClient } from '@supabase/supabase-js'

const OL = 'https://openlibrary.org/search.json'
const FIELDS = 'key,title,author_name,editions,editions.title,editions.language'
const MAX_BOOKS = 300
const CONCURRENCY = 5

function norm(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Saved author matches one of Open Library's (compares last names loosely)
function authorMatches(saved, olAuthors) {
  const s = norm(saved)
  if (!s) return true
  const last = s.split(' ').pop()
  return (olAuthors || []).some(a => { const n = norm(a); return n === s || n.split(' ').pop() === last || n.includes(s) || s.includes(n) })
}

async function olFetch(params) {
  const r = await fetch(`${OL}?${params}&lang=en&limit=1&fields=${FIELDS}`, { headers: { 'User-Agent': 'unscripted book club (backfill)' } })
  if (!r.ok) throw new Error(`OL ${r.status}`)
  const d = await r.json()
  return d.docs?.[0] || null
}

// "Fumitake Koga & Ichiro Kishimi" -> "Koga"
function firstLastName(author) {
  const first = String(author || '').split(/,|&| and /i)[0].trim()
  return first.split(/\s+/).pop() || ''
}

async function propose(book, siblings) {
  let doc = null
  let how = ''
  if (!book.book_key) {
    // Another saved copy of the same title is already linked: use its ID
    const twin = siblings.find(s => s.id !== book.id && s.book_key && norm(s.title) === norm(book.title))
    if (twin) {
      const d = await olFetch(`q=${encodeURIComponent(`key:/works/${twin.book_key}`)}`)
      if (d && authorMatches(book.author, d.author_name)) { doc = d; how = 'same book as another club’s copy' }
    }
  }
  if (doc) {
    // found via a linked copy
  } else if (book.book_key) {
    doc = await olFetch(`q=${encodeURIComponent(`key:/works/${book.book_key}`)}`)
    how = 'by ID'
  } else {
    const p = `title=${encodeURIComponent(book.title)}${book.author ? `&author=${encodeURIComponent(book.author)}` : ''}`
    doc = await olFetch(p)
    if (!doc && book.author) doc = await olFetch(`title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(firstLastName(book.author))}`)
    if (!doc) doc = await olFetch(`q=${encodeURIComponent(`${book.title} ${firstLastName(book.author)}`.trim())}`)
    how = 'by title'
    if (doc && !authorMatches(book.author, doc.author_name)) {
      return { ...base(book), status: 'skip', note: `Closest match "${doc.title}" by ${(doc.author_name || []).join(', ') || 'unknown'}: author doesn't match` }
    }
  }
  if (!doc) return { ...base(book), status: 'skip', note: 'Not found on Open Library' }

  const key = String(doc.key || '').replace('/works/', '') || null
  const edTitle = doc.editions?.docs?.[0]?.title || doc.title
  const savedIsOriginal = norm(book.title) === norm(doc.title)
  const newTitle = savedIsOriginal && norm(edTitle) !== norm(book.title) ? edTitle : null
  const newKey = !book.book_key && key ? key : null

  if (!newKey && !newTitle) return { ...base(book), status: 'ok', note: `Already correct (${how})` }
  return { ...base(book), status: 'change', new_key: newKey, new_title: newTitle, note: how }
}

function base(b) {
  return { id: b.id, club: b.club?.name || '', title: b.title, author: b.author || '', book_key: b.book_key || null }
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k]) } catch (e) { out[k] = { ...base(items[k]), status: 'skip', note: 'Open Library didn’t answer. Try again.' } }
    }
  }))
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (!url || !serviceKey || !adminEmail) return res.status(503).json({ error: 'Not set up yet: ADMIN_EMAIL (and the service role key) must be set in Vercel.', code: 'NOT_CONFIGURED' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Please log in again.', code: 'NO_SESSION' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  const email = (userData?.user?.email || '').toLowerCase()
  if (userErr || !email) return res.status(401).json({ error: 'Please log in again.', code: 'BAD_SESSION' })
  if (email !== adminEmail) return res.status(403).json({ error: 'Only the site admin can run this.', code: 'NOT_ADMIN' })

  const mode = req.body?.mode === 'apply' ? 'apply' : 'preview'
  let q = admin.from('books').select('id, title, author, book_key, club:clubs(name)').order('created_at').limit(MAX_BOOKS)
  if (mode === 'apply') {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, MAX_BOOKS) : []
    if (!ids.length) return res.status(400).json({ error: 'Nothing selected.', code: 'NO_IDS' })
    q = q.in('id', ids)
  }
  const { data: books, error } = await q
  if (error) return res.status(500).json({ error: 'Couldn’t read books.', code: 'READ_FAILED' })

  // All saved copies (for reusing an already-linked copy's ID)
  const { data: siblings } = await admin.from('books').select('id, title, book_key').not('book_key', 'is', null).limit(2000)
  const results = await mapLimit(books || [], CONCURRENCY, b => propose(b, siblings || []))
  if (mode === 'preview') return res.status(200).json({ results })

  let applied = 0
  const failed = []
  for (const r of results) {
    if (r.status !== 'change') continue
    const patch = {}
    if (r.new_key) patch.book_key = r.new_key
    if (r.new_title) patch.title = r.new_title
    const { error: uErr } = await admin.from('books').update(patch).eq('id', r.id)
    if (uErr) { failed.push(r.id); continue }
    if (r.new_title) {
      await admin.from('threads').update({ title: `Open Discussion: ${r.new_title}` })
        .eq('book_id', r.id).eq('chapter_number', 0).eq('title', `Open Discussion: ${r.title}`)
    }
    applied++
  }
  return res.status(200).json({ applied, failed, results })
}
