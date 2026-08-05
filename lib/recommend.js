// lib/recommend.js
// Pure heuristic recommendation logic for unscripted.
// No DB, no network, no React — just scoring. The component that uses this
// (components/Recommendations.jsx) queries Supabase and hands in normalized
// `signals`, so this file never needs to know exact table/column shapes.
//
// v1 = tag/author overlap scoring. A later LLM layer can re-rank the shortlist
// and write "why you'll like this" copy using the `why` data each pick carries.

// ---- tunable weights ---------------------------------------------------------
const W = {
  interest: 3,        // explicit tag from the interest prompt
  clubTag: 2,         // tag on a club you're already in
  shelfRead: 2,       // tags/author of a book you've read or are reading
  shelfWant: 1,       // tags/author of a book you want to read
  authorRead: 2,      // author affinity, read/reading
  authorWant: 1,      // author affinity, want
  authorMatchBonus: 2 // candidate shares an author you like
};

const MAX_PER_AUTHOR = 2; // diversity cap in book results

// ---- helpers -----------------------------------------------------------------
const norm = (s) => (s == null ? '' : String(s).trim().toLowerCase());
const arr = (x) => (Array.isArray(x) ? x : []);
const bookKey = (title, author) => `${norm(title)}|${norm(author)}`;

function bump(map, key, amount) {
  const k = norm(key);
  if (!k) return;
  map.set(k, (map.get(k) || 0) + amount);
}

// ---- taste profile -----------------------------------------------------------
// Builds weighted bags of tags and authors from everything we know about a user.
//
// signals: {
//   interests:  string[]                         // members.member_interests
//   shelved:    [{ title, author, tags, status }] // status: 'want'|'reading'|'read'
//   clubTags:   string[]                          // tags of clubs they're in
// }
export function buildTasteProfile(signals = {}) {
  const tagWeights = new Map();
  const authorWeights = new Map();

  for (const t of arr(signals.interests)) bump(tagWeights, t, W.interest);
  for (const t of arr(signals.clubTags)) bump(tagWeights, t, W.clubTag);

  for (const b of arr(signals.shelved)) {
    const read = b && (b.status === 'read' || b.status === 'reading');
    const tagW = read ? W.shelfRead : W.shelfWant;
    const authW = read ? W.authorRead : W.authorWant;
    for (const t of arr(b.tags)) bump(tagWeights, t, tagW);
    if (b && b.author) bump(authorWeights, b.author, authW);
  }

  return { tagWeights, authorWeights };
}

export function isEmptyProfile(taste) {
  return (
    !taste ||
    ((taste.tagWeights?.size || 0) === 0 && (taste.authorWeights?.size || 0) === 0)
  );
}

// ---- scoring -----------------------------------------------------------------
// Weighted tag overlap, softly normalized so heavily-tagged items don't dominate.
// Returns the score plus the matched tags/author for later explanation copy.
function scoreTags(tags, taste) {
  let score = 0;
  const matched = [];
  for (const t of arr(tags)) {
    const w = taste.tagWeights.get(norm(t)) || 0;
    if (w > 0) {
      score += w;
      matched.push(t);
    }
  }
  const denom = Math.sqrt(Math.max(1, arr(tags).length)); // soft length penalty
  return { score: score / denom, matched };
}

export function scoreBook(book, taste) {
  const { score, matched } = scoreTags(book.tags, taste);
  let total = score;
  const authorMatch = !!(book.author && taste.authorWeights.get(norm(book.author)));
  if (authorMatch) total += W.authorMatchBonus;
  return { score: total, why: { tags: matched, author: authorMatch ? book.author : null } };
}

export function scoreClub(club, taste) {
  const { score, matched } = scoreTags(club.tags, taste);
  return { score, why: { tags: matched, author: null } };
}

// ---- recommenders ------------------------------------------------------------
// Each returns a ranked array of { ...candidate, score, why }.
// When the profile is empty (brand-new user) we fall back to whatever the caller
// passed as `fallbackBooks` / `fallbackClubs` (e.g. trending) so the rail is
// never empty — mode is reported so the UI can label it ("Popular right now").

export function recommendBooks(signals = {}, opts = {}) {
  const { candidates = [], limit = 6, fallbackBooks = [] } = opts;
  const taste = buildTasteProfile(signals);

  const shelvedKeys = new Set(
    arr(signals.shelved).map((b) => bookKey(b.title, b.author))
  );

  if (isEmptyProfile(taste)) {
    return {
      mode: 'coldstart',
      items: fallbackBooks
        .filter((b) => !shelvedKeys.has(bookKey(b.title, b.author)))
        .slice(0, limit)
    };
  }

  const scored = candidates
    .filter((b) => !shelvedKeys.has(bookKey(b.title, b.author)))
    .map((b) => ({ ...b, ...scoreBook(b, taste) }))
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score);

  // per-author diversity cap
  const perAuthor = new Map();
  const items = [];
  for (const b of scored) {
    const a = norm(b.author);
    const n = perAuthor.get(a) || 0;
    if (n >= MAX_PER_AUTHOR) continue;
    perAuthor.set(a, n + 1);
    items.push(b);
    if (items.length >= limit) break;
  }

  return { mode: 'personalized', items };
}

export function recommendClubs(signals = {}, opts = {}) {
  const {
    candidates = [],
    limit = 4,
    fallbackClubs = [],
    myClubIds = [],
    openOnly = true
  } = opts;
  const taste = buildTasteProfile(signals);
  const mine = new Set(arr(myClubIds).map(norm));

  const eligible = (c) =>
    !mine.has(norm(c.id)) && (!openOnly || c.privacy === 'open');

  if (isEmptyProfile(taste)) {
    return {
      mode: 'coldstart',
      items: fallbackClubs.filter(eligible).slice(0, limit)
    };
  }

  const items = candidates
    .filter(eligible)
    .map((c) => ({ ...c, ...scoreClub(c, taste) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { mode: 'personalized', items };
}

// Convenience: everything in one call.
export function getRecommendations(signals = {}, opts = {}) {
  return {
    books: recommendBooks(signals, opts.books || {}),
    clubs: recommendClubs(signals, opts.clubs || {})
  };
}
