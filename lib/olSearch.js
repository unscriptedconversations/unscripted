// lib/olSearch.js
// Shared Open Library lookup for the homepage dropdown and /search.
//
// Session cache keyed by NORMALIZED QUERY ONLY. Because this module is a
// singleton in the client bundle, its cache persists across client-side
// navigations within a tab — so a term warmed on one surface is instant on the
// other. (A hard reload resets it; that's fine for a session cache.)
//
// We cache the RAW mapped results (pre-dedupe). Dedupe against on-platform
// titles is applied PER CALL, because each surface excludes a different catalog
// (homepage: loaded `books`; /search: that query's book hits). This keeps the
// cache a pure function of the query and safely reusable across both pages.
//
// Debounce + stale-response ordering are CALLER concerns (the homepage's
// keystroke model needs them; /search's submit model doesn't), so they live in
// the callers, not here.

const OL_URL = 'https://openlibrary.org/search.json'
const CACHE_MAX = 100
const cache = new Map() // normalizedQuery -> mapped[] (pre-dedupe)

function cacheSet(k, v) {
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  cache.set(k, v)
}

function dedupe(mapped, excludeTitles) {
  const onSite = new Set(excludeTitles.map((t) => String(t || '').toLowerCase()))
  return mapped.filter((b) => !onSite.has(b.title.toLowerCase())).slice(0, 8)
}

// Catalog/format cruft that Open Library returns as "subjects" but which isn't a
// topical tag. Small and editable on purpose — this removes non-topical noise,
// NOT a semantic vocabulary (no meaning/synonym decisions live here). Matched
// case-insensitively against the whole subject string.
const SUBJECT_NOISE = new Set([
  'accessible book', 'protected daisy', 'in library', 'overdrive',
  'large type books', 'large print', 'ebook', 'popular print disabled titles',
])

const MAX_SUBJECTS = 10

// Turn an Open Library `subject` array into candidate tag strings. Preserves the
// raw subject text (source of truth); drops noise and caps the count. Downstream
// write paths normalize these via lib/tags.js.
function extractSubjects(subject) {
  const out = []
  for (const s of subject || []) {
    const raw = String(s || '').trim()
    if (!raw) continue
    if (SUBJECT_NOISE.has(raw.toLowerCase())) continue
    out.push(raw)
    if (out.length >= MAX_SUBJECTS) break
  }
  return out
}

// Async lookup: returns up to 8 wider-catalog books, excluding on-site titles.
// Cache hits skip the network. Failures return [] and are NOT cached (retry).
function mapDoc(doc) {
  return {
    key: doc.key.replace('/works/', ''),
    title: doc.title,
    author: (doc.author_name || []).join(', '),
    cover: doc.cover_i,
    year: doc.first_publish_year,
  }
}

export async function olSearch(query, { excludeTitles = [] } = {}) {
  const key = String(query || '').trim().toLowerCase()
  if (key.length < 2) return []

  let mapped = cache.get(key)
  if (!mapped) {
    try {
      const r = await fetch(
        `${OL_URL}?q=${encodeURIComponent(query)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year`
      )
      const d = await r.json()
      mapped = (d.docs || [])
        .filter((doc) => doc.title && doc.key)
        .map(mapDoc)
      cacheSet(key, mapped)
    } catch {
      return []
    }
  }
  return dedupe(mapped, excludeTitles)
}

// Synchronous cache peek: returns deduped hits if the query is already warm,
// else null. Lets the homepage render instantly on a hit (no debounce, no
// network) without awaiting.
export function olPeek(query, { excludeTitles = [] } = {}) {
  const key = String(query || '').trim().toLowerCase()
  const mapped = cache.get(key)
  return mapped ? dedupe(mapped, excludeTitles) : null
}

// Strip everything but digits and a trailing X (ISBN-10 check digit).
function normalizeIsbn(isbn) {
  return String(isbn || '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

// Exact lookup for the manual-add flow: resolve an ISBN to a single normalized
// book, or null. Reuses the shared fetch/map/cache path via an `isbn:` query,
// but (unlike olSearch) does NOT dedupe or slice — the caller wants this exact
// book regardless of what's already on the platform. The returned object
// carries the cleaned isbn so the caller can persist it directly.
export async function olLookupIsbn(isbn) {
  const clean = normalizeIsbn(isbn)
  if (clean.length !== 10 && clean.length !== 13) return null

  const cacheK = `isbn:${clean}`
  let mapped = cache.get(cacheK)
  if (!mapped) {
    try {
      const r = await fetch(
        `${OL_URL}?q=isbn:${encodeURIComponent(clean)}&limit=1&fields=key,title,author_name,cover_i,first_publish_year,subject`
      )
      const d = await r.json()
      mapped = (d.docs || [])
        .filter((doc) => doc.title && doc.key)
        .map((doc) => ({ ...mapDoc(doc), subjects: extractSubjects(doc.subject) }))
      cacheSet(cacheK, mapped)
    } catch {
      return null
    }
  }
  return mapped.length ? { ...mapped[0], isbn: clean } : null
}
