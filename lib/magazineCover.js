// Placeholder magazine covers, derived from title — no DB storage.
// Returns an inline SVG data URI (never 404s). Used as a fallback when
// magazines.cover_url is null; real/partner covers overwrite it later
// with zero render changes: <img src={m.cover_url || magazineCover(m.title)} />.
//
// Palette evokes each publication (color + serif initial) without
// reproducing any logo. Add rows here to restyle; unknown titles get a
// neutral tile with a derived initial.

const PALETTE = {
  'The New Yorker':     { bg: '#F2ECE0', ink: '#1A1A1A', ch: 'N', border: true  },
  'The Atlantic':       { bg: '#A6192E', ink: '#FFFFFF', ch: 'A', border: false },
  'Jet':                { bg: '#E4002B', ink: '#FFFFFF', ch: 'J', border: false },
  'Ebony':              { bg: '#141414', ink: '#E0B04A', ch: 'E', border: false },
  'Essence':            { bg: '#7B2D6B', ink: '#FFFFFF', ch: 'E', border: false },
  'The New York Times': { bg: '#FCFCFA', ink: '#121212', ch: 'T', border: true  },
  "Barron's":           { bg: '#12643C', ink: '#FFFFFF', ch: 'B', border: false },
}

const FALLBACK = { bg: '#E8E2D6', ink: '#3A352C', border: true }

function initial(title) {
  const t = String(title || '').replace(/^the\s+/i, '').trim()
  const m = t.match(/[A-Za-z0-9]/)
  return m ? m[0].toUpperCase() : '?'
}

export function magazineCover(title) {
  const p = PALETTE[title] || { ...FALLBACK, ch: initial(title) }
  const border = p.border
    ? "<rect x='1' y='1' width='98' height='138' fill='none' stroke='#D8D2C4' stroke-width='2'/>"
    : ''
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>" +
    `<rect width='100' height='140' fill='${p.bg}'/>` +
    border +
    `<text x='50' y='50%' fill='${p.ink}' font-family='Georgia, Times New Roman, serif' ` +
    `font-size='72' font-weight='600' text-anchor='middle' dominant-baseline='central'>${p.ch}</text>` +
    '</svg>'
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
