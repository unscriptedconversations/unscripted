// lib/tags.js
// Structural tag normalization — the single source of truth for turning a raw
// tag (user text, an Open Library subject, a seed value) into a match key.
//
// DESIGN CONTRACT (read before changing):
//   * Raw tags are the source of truth and are stored UNCHANGED for display.
//   * The value this returns is DERIVED and DISPOSABLE — recompute it from raw
//     any time the rule changes. Never overwrite a raw tag with its normalized
//     form; that would be a lossy, irreversible decision.
//   * Apply the SAME function to stored tags and to a search term, so both sides
//     match under one rule.
//
// This layer is deliberately MECHANICAL, not semantic: case, whitespace,
// accents, and wrapping punctuation only. It makes no judgement about meaning.
// Opinionated transforms (stemming, singular/plural, synonyms, aliases,
// controlled vocab) are intentionally NOT here — see EXTENSION POINT below.

// Normalize one tag to its match key. Returns '' if nothing meaningful remains.
export function normalizeTag(raw) {
  let s = String(raw == null ? '' : raw)
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // fold accents: café -> cafe
  s = s.toLowerCase()
  s = s.replace(/\s+/g, ' ').trim()                       // collapse + trim whitespace
  // Strip wrapping (leading/trailing) non-alphanumerics, but keep internal ones
  // so 'sci-fi', "children's", 'rock & roll' survive intact.
  s = s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '')

  // EXTENSION POINT (additive, reversible): apply an optional alias/synonym map
  // AFTER structural normalization, e.g. `return ALIASES[s] || s`. Kept off by
  // default so no semantic assumptions are baked in yet. Because it operates on
  // the derived key and never touches raw, it can be switched on later with a
  // recompute and no data migration.
  return s
}

// Normalize a collection of tags. Accepts an array OR a comma-separated string
// (both write paths currently split on commas — funnel them through here).
// Drops empties and de-dupes, preserving first-seen order.
export function normalizeTags(input) {
  let arr
  if (Array.isArray(input)) arr = input
  else if (typeof input === 'string') arr = input.split(',')
  else if (input == null) arr = []
  else arr = [input]

  const seen = new Set()
  const out = []
  for (const item of arr) {
    const t = normalizeTag(item)
    if (t && !seen.has(t)) { seen.add(t); out.push(t) }
  }
  return out
}
