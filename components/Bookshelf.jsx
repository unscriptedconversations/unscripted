import { useState } from 'react'
import { useRouter } from 'next/router'

// Cartoon bookshelf for the profile page. Chunky outlined spines in bright flat
// colors, a few leaning, on a wobbly wooden plank. Each spine carries its title
// on a cream label. Same title -> same color, size, decoration and lean.
//
// Props:
//   books        : [{ title, author, book_key, status }]  (already filtered/passed in)
//   shelfLinks   : { [title]: book_key }  fallback key resolution for rows w/o book_key
//   onSelectBook : optional; when set, tapping a spine calls it instead of navigating

const OUTLINE = '#2C2C2A'
const LABEL = '#FFF6E0'
const COLORS = ['#E8684A', '#3FB59A', '#8A7FE0', '#F2B33D', '#EE8FB0', '#4A93E0', '#8CC152', '#F59E78', '#6CC4E8']
const WIDTHS = [46, 52, 58, 64]
const HEIGHTS = [164, 176, 188, 200]
const LEANS = [0, 0, 0, 4, 0, 0, -4, 0] // about 1 in 4 books leans, either way

// djb2 string hash -> unsigned int. Dependency-free, stable across runs.
function hash(str) {
  let h = 5381
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}

function spineLook(title) {
  const h = hash(title)
  return {
    h,
    fill: COLORS[h % COLORS.length],
    width: WIDTHS[(h >>> 4) % WIDTHS.length],
    height: HEIGHTS[(h >>> 7) % HEIGHTS.length],
    decor: (h >>> 10) % 4,
    lean: LEANS[(h >>> 13) % LEANS.length],
  }
}

function spineHref(item, shelfLinks) {
  if (item.book_key) return `/book/${item.book_key}`
  const k = shelfLinks && shelfLinks[item.title]
  return k ? `/book/${k}` : null
}

// Fit a title on the label: one line if it fits at a readable size, else two
// lines on spines wide enough, else one line truncated. CW = approx char width
// as a fraction of font size for a bold sans.
const CW = 0.66
function fitTitle(title, avail, labelW) {
  const t = String(title || '').trim()
  const one = Math.min(13, avail / (t.length * CW))
  if (one >= 10.5) return { lines: [t], size: one }
  if (labelW >= 40) {
    const words = t.split(/\s+/)
    let best = null
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ')
      const len = Math.max(a.length, b.length)
      if (!best || len < best.len) best = { a, b, len }
    }
    if (best) {
      const size = Math.max(9.5, Math.min(13, avail / (best.len * CW)))
      const max = Math.floor(avail / (size * CW))
      const cut = s => s.length > max ? s.slice(0, max - 1) + '…' : s
      return { lines: [cut(best.a), cut(best.b)], size }
    }
  }
  const size = Math.max(9.5, one)
  const max = Math.floor(avail / (size * CW))
  return { lines: [t.length > max ? t.slice(0, max - 1) + '…' : t], size }
}

// Small per-book wobble so no two spines have identical corners.
function wob(h, shift) { return (((h >>> shift) % 5) - 2) * 0.7 }

function Spine({ title, look }) {
  const { h, fill, width: w, height: ht, decor } = look
  const cx = w / 2
  const a = wob(h, 2), b = wob(h, 5), c = wob(h, 8)
  const r = 7
  const body = `M 3 ${ht - 2} L ${3 + a} ${r + 3} Q ${3 + a} 3 ${3 + a + r} 3 L ${w - 3 - r + b} ${3 + b} Q ${w - 3 + b} ${3 + b} ${w - 3 + b} ${r + 3 + b} L ${w - 3 + c} ${ht - 2} Z`

  const labelY = 28, labelH = ht - 56
  const fit = fitTitle(title, labelH - 12, w - 16)
  const midY = labelY + labelH / 2
  const lineGap = fit.size * 1.15

  return (
    <svg width={w + 4} height={ht + 2} viewBox={`-2 0 ${w + 4} ${ht + 2}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={body} fill={fill} stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />

      {decor === 0 && <g stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round">
        <line x1="8" y1="17" x2={w - 8} y2="17" /><line x1="8" y1={ht - 15} x2={w - 8} y2={ht - 15} />
      </g>}
      {decor === 1 && <g stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5">
        <line x1="9" y1="17" x2={w - 9} y2="17" /><line x1="9" y1={ht - 15} x2={w - 9} y2={ht - 15} />
      </g>}
      {decor === 2 && <g fill={LABEL} stroke={OUTLINE} strokeWidth="2">
        <circle cx={cx - 8} cy="17" r="3.5" /><circle cx={cx + 8} cy="17" r="3.5" /><circle cx={cx} cy={ht - 15} r="3.5" />
      </g>}
      {decor === 3 && <g fill={LABEL} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
        <path d={`M ${cx} 10 L ${cx + 5} 17 L ${cx} 24 L ${cx - 5} 17 Z`} />
        <path d={`M ${cx} ${ht - 22} L ${cx + 5} ${ht - 15} L ${cx} ${ht - 8} L ${cx - 5} ${ht - 15} Z`} />
      </g>}

      <rect x="8" y={labelY} width={w - 16} height={labelH} rx="6" fill={LABEL} stroke={OUTLINE} strokeWidth="2.5" />
      <text
        fill={OUTLINE}
        fontFamily="'Trebuchet MS', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif"
        fontSize={fit.size.toFixed(1)}
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(-90 ${cx} ${midY})`}
      >
        {fit.lines.map((ln, i) => (
          <tspan key={i} x={cx} y={midY + (i - (fit.lines.length - 1) / 2) * lineGap}>{ln}</tspan>
        ))}
      </text>
    </svg>
  )
}

export default function Bookshelf({ books = [], shelfLinks = {}, onSelectBook }) {
  const router = useRouter()
  const [hover, setHover] = useState(-1)

  if (!books.length) {
    return (
      <div>
        <div style={{ height: 132, background: 'var(--sf)', border: '2.5px dashed var(--bd2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6 }}>
            No books on your shelf yet.<br />Mark a book as <strong style={{ color: 'var(--ink)' }}>Reading</strong> or <strong style={{ color: 'var(--ink)' }}>Read</strong> and it lands here.
          </div>
        </div>
        <Plank />
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', paddingTop: 18 }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 28px' }}>
          {books.map((b, i) => {
            const href = spineHref(b, shelfLinks)
            const look = spineLook(b.title)
            const clickable = !!onSelectBook || !!href
            const up = hover === i
            // Leaning books pivot on their bottom corner; reserve room for the lean.
            const room = look.lean ? Math.ceil(look.height * Math.sin(Math.abs(look.lean) * Math.PI / 180)) : 0
            return (
              <div
                key={(b.book_key || b.title) + i}
                onClick={() => onSelectBook ? onSelectBook(b) : (href && router.push(href))}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                role={clickable ? 'button' : undefined}
                aria-label={onSelectBook ? `Annotate ${b.title}` : (href ? `Open ${b.title}` : b.title)}
                title={b.author ? `${b.title} — ${b.author}` : b.title}
                style={{
                  cursor: clickable ? 'pointer' : 'default',
                  marginLeft: look.lean < 0 ? room : 0,
                  marginRight: look.lean > 0 ? room : 0,
                  marginBottom: -2,
                  transformOrigin: look.lean > 0 ? 'bottom left' : 'bottom right',
                  // Hover: hop up and straighten, with a little overshoot
                  transform: up ? 'translateY(-12px) rotate(0deg)' : `rotate(${look.lean}deg)`,
                  transition: 'transform 280ms cubic-bezier(.34, 1.7, .64, 1)',
                  filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.16))',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: up ? 2 : 1,
                }}
              >
                <Spine title={b.title} look={look} />
              </div>
            )
          })}
        </div>
        <Plank />
      </div>
    </div>
  )
}

// Wobbly wooden plank with two brackets.
function Plank() {
  const bracket = (side) => (
    <svg width="34" height="30" viewBox="0 0 34 30" style={{ position: 'absolute', top: 22, [side]: '8%' }} aria-hidden="true">
      <path d={side === 'left' ? 'M 4 2 L 4 27 L 31 2 Z' : 'M 30 2 L 30 27 L 3 2 Z'} fill="#854F0B" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
  return (
    <div style={{ position: 'relative', minWidth: '100%', paddingBottom: 30 }}>
      <div style={{
        position: 'relative', zIndex: 3, height: 22, background: '#C98A2E',
        border: `3px solid ${OUTLINE}`, borderRadius: '8px 12px 9px 6px / 6px 9px 7px 10px',
        transform: 'rotate(-0.4deg)', overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 20" aria-hidden="true" style={{ display: 'block' }}>
          <path d="M 6 9 Q 14 6 22 9 M 40 12 Q 50 15 60 11 M 74 8 Q 84 5 94 9" fill="none" stroke={OUTLINE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.55" />
        </svg>
      </div>
      {bracket('left')}
      {bracket('right')}
    </div>
  )
}
