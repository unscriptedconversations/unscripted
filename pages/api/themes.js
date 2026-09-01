// pages/api/themes.js
// AI theme suggestions for the writing composer. Takes a draft (title + content)
// and returns a few short thematic tags the author can review before publishing.
//
// STRICTLY ADDITIVE + DORMANT: if ANTHROPIC_API_KEY is unset or anything fails,
// this returns an empty list (not an error), so the composer works exactly the
// same with or without it. Suggestions are advisory — the author always edits
// the tags field, so this never auto-applies AI output.
//
// Payment-gated: activates only once ANTHROPIC_API_KEY is set in Vercel (a
// funded account). Same cost/safety guards as pages/api/recommend.js.

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const MIN_CONTENT = 200        // too short to have themes worth extracting
const MAX_CONTENT = 6000       // cap tokens sent to the model
const MAX_THEMES = 6
const MAX_THEME_LEN = 40
const UPSTREAM_TIMEOUT_MS = 5000
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min
const CACHE_MAX = 500

const cache = new Map() // key -> { value, exp }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ themes: [], disabled: true })

  const body = req.body || {}
  const title = String(body.title || '').slice(0, 200)
  const content = String(body.content || '').slice(0, MAX_CONTENT)
  if (content.trim().length < MIN_CONTENT) return res.status(200).json({ themes: [] })

  const cacheKey = hashKey(title + '\u0000' + content)
  const cached = cacheGet(cacheKey)
  if (cached) return res.status(200).json(cached)

  const system =
    'You extract themes from a piece of writing about a book. Respond with ONLY ' +
    'valid JSON, no markdown, no prose: {"themes":["..."]}. Give 3-6 short, ' +
    'lowercase thematic tags (1-3 words each), e.g. "grief", "coming of age", ' +
    '"identity". Themes only — no plot summary, no character or author names, no ' +
    'spoilers. If unsure, return fewer.'

  const user = `Title: ${title}\n\nWriting:\n${content}`

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
        max_tokens: 256,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: ctrl.signal,
    })

    if (!r.ok) return res.status(200).json({ themes: [] })
    const data = await r.json()

    const text = (data.content || [])
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
      .trim()

    const parsed = safeParse(text)
    if (!parsed || !Array.isArray(parsed.themes)) return res.status(200).json({ themes: [] })

    const seen = new Set()
    const themes = []
    for (const t of parsed.themes) {
      const s = String(t || '').trim().slice(0, MAX_THEME_LEN)
      const k = s.toLowerCase()
      if (s && !seen.has(k)) { seen.add(k); themes.push(s) }
      if (themes.length >= MAX_THEMES) break
    }

    const result = { themes }
    if (themes.length) cacheSet(cacheKey, result)
    return res.status(200).json(result)
  } catch (e) {
    return res.status(200).json({ themes: [] })
  } finally {
    clearTimeout(timer)
  }
}

function safeParse(text) {
  if (!text) return null
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  try { return JSON.parse(t) } catch { return null }
}

function hashKey(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return 't1:' + (h >>> 0).toString(36)
}

function cacheGet(k) {
  const hit = cache.get(k)
  if (!hit) return null
  if (Date.now() > hit.exp) { cache.delete(k); return null }
  return hit.value
}

function cacheSet(k, value) {
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  cache.set(k, { value, exp: Date.now() + CACHE_TTL_MS })
}
