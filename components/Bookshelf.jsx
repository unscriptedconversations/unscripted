import { useState } from 'react'
import { useRouter } from 'next/router'
import { bookSpine } from '../lib/bookSpine'

// Read-only storybook bookshelf for the profile page. Renders the member's
// finished (status: 'read') books as thick, gilt-banded leather spines on a
// wooden ledge — horizontally scrollable, each spine a link to its book page.
//
// Props:
//   books      : [{ title, author, book_key, status }]  (already filtered/passed in)
//   shelfLinks : { [title]: book_key }  fallback key resolution for rows w/o book_key

function spineHref(item, shelfLinks) {
  if (item.book_key) return `/book/${item.book_key}`
  const k = shelfLinks && shelfLinks[item.title]
  return k ? `/book/${k}` : null
}

// One spine drawn as inline SVG — precise bands, gilt frame, domed shading,
// ornaments, and vertical title. uid keeps gradient ids unique per spine.
function Spine({ title, tokens, uid }) {
  const { bg, ink, width: w, height: h, bands, radius: r } = tokens
  const cx = w / 2
  const maxChars = Math.max(4, Math.floor((h - 52) / 8))
  const label = title.length > maxChars ? title.slice(0, maxChars - 1) + '…' : title

  const rules = [] // double/triple gold hairlines near top and bottom
  const n = bands - 1
  for (let i = 0; i < n; i++) {
    rules.push(30 + i * 4)          // top cluster
    rules.push(h - 30 - i * 4)      // bottom cluster
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.22" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.24" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={w} height={h} rx={r} fill={bg} />
      <rect x="0" y="0" width={w} height={h} rx={r} fill={`url(#g${uid})`} />
      <rect x="3" y="3" width={w - 6} height={h - 6} rx={Math.max(1, r - 3)} fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="1" />
      {rules.map((y, i) => (
        <g key={i}>
          <rect x="4" y={y} width={w - 8} height="2.5" fill={ink} opacity="0.85" />
          <rect x="4" y={y - 1.5} width={w - 8} height="1" fill="#000" opacity="0.22" />
          <rect x="4" y={y + 2.5} width={w - 8} height="1" fill="#000" opacity="0.22" />
        </g>
      ))}
      {/* ornaments: small gilt diamonds top + bottom */}
      <rect x={cx - 3.5} y="12" width="7" height="7" fill={ink} transform={`rotate(45 ${cx} 15.5)`} />
      <rect x={cx - 3.5} y={h - 19} width="7" height="7" fill={ink} transform={`rotate(45 ${cx} ${h - 15.5})`} />
      {/* vertical gilt title */}
      <text
        x={cx}
        y={h / 2}
        fill={ink}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="13"
        fontWeight="600"
        textAnchor="middle"
        transform={`rotate(-90 ${cx} ${h / 2})`}
      >
        {label}
      </text>
    </svg>
  )
}

export default function Bookshelf({ books = [], shelfLinks = {} }) {
  const router = useRouter()
  const [hover, setHover] = useState(-1)

  if (!books.length) {
    return (
      <div>
        <div style={{ height: 132, background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6 }}>
            No finished books yet.<br />Mark a book as <strong style={{ color: 'var(--ink)' }}>Read</strong> and it lands on your shelf.
          </div>
        </div>
        <Ledge />
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', paddingTop: 8 }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 24px 0' }}>
          {books.map((b, i) => {
            const href = spineHref(b, shelfLinks)
            const tokens = bookSpine(b.title)
            return (
              <div
                key={(b.book_key || b.title) + i}
                onClick={() => href && router.push(href)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                role={href ? 'button' : undefined}
                aria-label={href ? `Open ${b.title}` : b.title}
                title={b.author ? `${b.title} — ${b.author}` : b.title}
                style={{
                  cursor: href ? 'pointer' : 'default',
                  transform: hover === i ? 'translateY(-8px)' : 'none',
                  transition: 'transform 160ms ease',
                  filter: hover === i ? 'drop-shadow(0 8px 10px rgba(0,0,0,0.28))' : 'drop-shadow(0 3px 4px rgba(0,0,0,0.22))',
                  flexShrink: 0,
                }}
              >
                <Spine title={b.title} tokens={tokens} uid={i} />
              </div>
            )
          })}
        </div>
        <Ledge />
      </div>
    </div>
  )
}

function Ledge() {
  return (
    <div style={{ minWidth: '100%' }}>
      <div style={{ height: 14, background: 'linear-gradient(to bottom, #8A6A46, #6B4A2E)', borderRadius: '3px 3px 0 0' }} />
      <div style={{ height: 7, background: 'rgba(0,0,0,0.22)', borderRadius: '0 0 4px 4px' }} />
    </div>
  )
}
