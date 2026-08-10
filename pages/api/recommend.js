// pages/api/recommend.js
// v2 LLM layer for recommendations. Takes the heuristic shortlist, asks a small
// fast model to curate/re-order it and write a one-line reason per pick.
//
// STRICTLY ADDITIVE: if ANTHROPIC_API_KEY is unset or anything fails, this
// returns empty lists (not an error), so the client falls back to the heuristic
// order with no blurbs. v1 never breaks.
//
// Requires env var ANTHROPIC_API_KEY (set in Vercel → Project → Settings → Env
// Vars, Production + Preview). The key stays server-side; never sent to client.
//
// COST / SAFETY GUARDS (added S16, all no-op until the key is set):
//   1. Input caps — never send more than MAX_BOOKS / MAX_CLUBS / MAX_INTERESTS
//      to the model, regardless of what the client posts, to bound token cost.
//   2. Upstream timeout — abort the Anthropic call at UPSTREAM_TIMEOUT_MS (below
//      the client's 6s), so a hung/slow call can't keep the function (and a
//      billed request) alive after the client has already given up.
//   3. In-memory TTL cache — dedupes identical payloads so repeat renders don't
//      each pay for a call. NOTE: this Map lives in the serverless instance's
//      memory, so it only spans a warm lambda and is per-instance, not global.
//      It's a stub: for true per-member caching across instances, swap
//      cacheGet/cacheSet for Vercel KV / Redis (same signatures). Only
//      SUCCESSFUL curations are cached, so a transient failure always retries.

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const MAX_BOOKS = 12
const MAX_CLUBS = 8
const MAX_INTERESTS = 20
const UPSTREAM_TIMEOUT_MS = 5000
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min
const CACHE_MAX = 500 // bound memory in a long-lived warm instance

// Module-level cache — see note above re: per-instance / ephemeral.
const cache = new Map() // key -> { value, exp }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ books: [], clubs: [], disabled: true })

  const body = req.body || {}
  // Cap inputs before anything else so ids, prompt, and cache key all agree.
  const interests = (Array.isArray(body.interests) ? body.interests : []).slice(0, MAX_INTERESTS)
  const books = (Array.isArray(body.books) ? body.books : []).slice(0, MAX_BOOKS)
  const clubs = (Array.isArray(body.clubs) ? body.clubs : []).slice(0, MAX_CLUBS)

  if (books.length === 0 && clubs.length === 0) {
    return res.status(200).json({ books: [], clubs: [] })
  }

  // Compact candidate payload — only what the model needs to reason + write copy.
  const bookLines = books.map((b) => ({
    id: b.id, title: b.title, author: b.author, tags: b.tags || [],
  }))
  const clubLines = clubs.map((c) => ({
    id: c.id, name: c.name, tags: c.tags || [],
  }))

  // Cache key: deterministic over exactly what shapes the model's answer.
  const cacheKey = hashKey({ interests, bookLines, clubLines })
  const cached = cacheGet(cacheKey)
  if (cached) return res.status(200).json(cached)

  const system =
    'You curate book-club recommendations. Respond with ONLY valid JSON, no ' +
    'markdown, no prose. Never invent books, clubs, ids, or facts. Only use ids ' +
    'from the input. Each "reason" is one warm sentence, max 14 words, grounded ' +
    "in the reader's interests or the item's tags. No spoilers."

  const user =
    `Reader interests: ${JSON.stringify(interests)}\n` +
    `Candidate books: ${JSON.stringify(bookLines)}\n` +
    `Candidate clubs: ${JSON.stringify(clubLines)}\n\n` +
    'Pick and order the best up to 6 books and up to 4 clubs for this reader. ' +
    'Return exactly this shape: ' +
    '{"books":[{"id":"...","reason":"..."}],"clubs":[{"id":"...","reason":"..."}]}'

  // Server-side timeout — independent of (and below) the client's abort, so a
  // slow upstream can't keep this function or a billed call alive pointlessly.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: ctrl.signal,
    })

    if (!r.ok) return res.status(200).json({ books: [], clubs: [] })
    const data = await r.json()

    const text = (data.content || [])
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
      .trim()

    const parsed = safeParse(text)
    if (!parsed) return res.status(200).json({ books: [], clubs: [] })

    // Keep only ids we actually sent — guards against any hallucinated id.
    const bookIds = new Set(books.map((b) => String(b.id)))
    const clubIds = new Set(clubs.map((c) => String(c.id)))
    const clean = (items, allowed) =>
      (Array.isArray(items) ? items : [])
        .filter((x) => x && allowed.has(String(x.id)))
        .map((x) => ({ id: String(x.id), blurb: String(x.reason || '').slice(0, 120) }))

    const result = {
      books: clean(parsed.books, bookIds),
      clubs: clean(parsed.clubs, clubIds),
    }

    // Cache only real curations, so transient failures above always retry.
    if (result.books.length || result.clubs.length) cacheSet(cacheKey, result)

    return res.status(200).json(result)
  } catch (e) {
    // Includes AbortError from the timeout — client keeps the heuristic order.
    return res.status(200).json({ books: [], clubs: [] })
  } finally {
    clearTimeout(timer)
  }
}

// Tolerate accidental ```json fences or leading/trailing prose.
function safeParse(text) {
  if (!text) return null
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  try { return JSON.parse(t) } catch { return null }
}

// --- cache stub (swap body for Vercel KV / Redis for cross-instance caching) ---

// djb2 string hash — dependency-free, runtime-agnostic (no crypto import).
// Collisions are harmless here: worst case a near-identical payload reuses a
// TTL-bounded curation. Prefixed 'r1' so the key space is easy to bump/invalidate.
function hashKey(obj) {
  const s = JSON.stringify(obj)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return 'r1:' + (h >>> 0).toString(36)
}

function cacheGet(k) {
  const hit = cache.get(k)
  if (!hit) return null
  if (Date.now() > hit.exp) { cache.delete(k); return null }
  return hit.value
}

function cacheSet(k, value) {
  // Evict oldest (Map preserves insertion order) once over the cap.
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  cache.set(k, { value, exp: Date.now() + CACHE_TTL_MS })
}
