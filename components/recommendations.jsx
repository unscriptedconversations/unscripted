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

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ books: [], clubs: [], disabled: true })

  const { interests = [], books = [], clubs = [] } = req.body || {}
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

  const system =
    'You curate book-club recommendations. Respond with ONLY valid JSON, no ' +
    'markdown, no prose. Never invent books, clubs, ids, or facts. Only use ids ' +
    'from the input. Each "reason" is one warm sentence, max 14 words, grounded ' +
    'in the reader\'s interests or the item\'s tags. No spoilers.'

  const user =
    `Reader interests: ${JSON.stringify(interests)}\n` +
    `Candidate books: ${JSON.stringify(bookLines)}\n` +
    `Candidate clubs: ${JSON.stringify(clubLines)}\n\n` +
    'Pick and order the best up to 6 books and up to 4 clubs for this reader. ' +
    'Return exactly this shape: ' +
    '{"books":[{"id":"...","reason":"..."}],"clubs":[{"id":"...","reason":"..."}]}'

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

    return res.status(200).json({
      books: clean(parsed.books, bookIds),
      clubs: clean(parsed.clubs, clubIds),
    })
  } catch (e) {
    return res.status(200).json({ books: [], clubs: [] })
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
