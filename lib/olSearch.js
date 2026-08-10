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

// Async lookup: returns up to 8 wider-catalog books, excluding on-site titles.
// Cache hits skip the network. Failures return [] and are NOT cached (retry).
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
        .map((doc) => ({
          key: doc.key.replace('/works/', ''),
          title: doc.title,
          author: (doc.author_name || []).join(', '),
          cover: doc.cover_i,
          year: doc.first_publish_year,
        }))
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
