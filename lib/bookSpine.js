// lib/bookSpine.js
// Deterministic spine styling for the profile bookshelf — an ornate, storybook
// aesthetic: thick leather-and-gilt spines with traditional raised bands, so the
// shelf reads like a row of old bound tomes. Same title -> same spine; the shelf
// as a whole looks varied.
//
// Pure + presentational: returns tokens only. The Bookshelf component renders
// them as DOM (rounded corners, a domed highlight for the curved-spine look,
// raised bands, a gilt panel border, a small drawn diamond ornament, and the
// vertical gilt title).

// Deep leather / jewel grounds paired with a gilt (gold) ink.
const CLOTH = [
  { bg: '#5A3A22', ink: '#E3C070' }, // brown leather
  { bg: '#6E2233', ink: '#E8C86A' }, // burgundy
  { bg: '#2E4632', ink: '#D9BE76' }, // forest
  { bg: '#26364F', ink: '#D8C07A' }, // navy
  { bg: '#4B2E51', ink: '#E6C878' }, // plum
  { bg: '#703B1E', ink: '#ECC96E' }, // chestnut
  { bg: '#34302B', ink: '#D7B45E' }, // espresso
  { bg: '#245046', ink: '#D9C074' }, // deep teal
]

const WIDTHS = [46, 52, 58, 64]         // thick
const HEIGHTS = [152, 164, 176, 188]    // slightly uneven, like real tomes

// djb2 string hash -> unsigned int. Dependency-free, stable across runs.
function hash(str) {
  let h = 5381
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}

export function bookSpine(title) {
  const h = hash(title)
  const cloth = CLOTH[h % CLOTH.length]
  const width = WIDTHS[(h >>> 3) % WIDTHS.length]
  const height = HEIGHTS[(h >>> 6) % HEIGHTS.length]
  const bands = 3 + ((h >>> 9) % 2)       // 3 or 4 raised bands
  const radius = Math.round(width * 0.22) // rounded corners
  return { bg: cloth.bg, ink: cloth.ink, width, height, bands, radius }
}
