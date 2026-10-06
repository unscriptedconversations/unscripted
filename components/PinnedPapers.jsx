import { useState } from 'react'

// Cartoon stack of papers thumbtacked to the wall, shown beside the profile
// bookshelves. The stack thickens with the member's published writings on a
// doubling curve: 1 -> 1 sheet, 2 -> 2, 3-4 -> 3, 5-8 -> 4, 9-16 -> 5, 17+ -> 6.
//
// Props:
//   count   : number of published writings
//   isOwner : viewing your own profile
//   onOpen  : tap handler when there are writings (e.g. jump to the Writing tab)
//   onWrite : tap handler for the owner's empty state (e.g. open the editor)
// Renders nothing for visitors when count is 0.

const OUTLINE = '#2C2C2A'
const SHEETS = ['#FFF6E0', '#F7EEDB', '#F0E6D0', '#E8DCC4', '#E2D5BA', '#DCCDB0'] // front -> back
const TILTS = [0, 3, -3.5, 4.5, -5, 6]                                              // front -> back
const W = 120, H = 158                                                              // one sheet

export function sheetsFor(count) {
  if (!count || count < 1) return 1
  return Math.min(6, 1 + Math.ceil(Math.log2(count)))
}

// A sheet with slightly uneven corners so it reads hand-drawn.
function sheetPath(k) {
  const j = [0.8, -1.2, 1.4, -0.6, 1.1, -1.4][k % 6]
  return `M 3 ${5 + j} L ${W - 4} 2 L ${W - 1} ${H - 3 - j} L 2 ${H - 1} Z`
}

export default function PinnedPapers({ count = 0, isOwner = false, onOpen, onWrite }) {
  const [hover, setHover] = useState(false)
  if (!count && !isOwner) return null

  const n = sheetsFor(count)
  const empty = !count
  const label = empty ? 'Pin your first piece' : `${count} ${count === 1 ? 'writing' : 'writings'}`
  const pad = 14 // room for back sheets to peek out
  const vbW = W + pad * 2 + 12, vbH = H + pad * 2 + 26 // + room for the stack's depth
  const cx = pad + W / 2

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={empty ? 'Write your first piece' : `View ${label}`}
      onClick={empty ? onWrite : onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (empty ? onWrite : onOpen)?.() } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer', width: vbW, flexShrink: 0, outline: 'none',
        transformOrigin: `${cx}px 22px`, // swing from the tack
        transform: hover ? 'rotate(-3deg)' : 'rotate(0deg)',
        transition: 'transform 320ms cubic-bezier(.34, 1.7, .64, 1)',
        filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.14))',
      }}
    >
      <svg width={vbW} height={vbH} viewBox={`0 0 ${vbW} ${vbH}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* back sheets first, front sheet last */}
        {Array.from({ length: n }, (_, idx) => n - 1 - idx).map(k => (
          <g key={k} transform={`translate(${pad + k * 2.5} ${pad + k * 5}) rotate(${TILTS[k]} ${W / 2} 10)`}>
            <path d={sheetPath(k)} fill={SHEETS[k]} stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
          </g>
        ))}

        {/* front sheet contents */}
        <g transform={`translate(${pad} ${pad})`}>
          {empty ? (
            <g stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" fill="none">
              <path d={`M ${W / 2 - 14} 66 L ${W / 2 + 14} 66 M ${W / 2} 52 L ${W / 2} 80`} />
            </g>
          ) : (
            <g stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" opacity="0.4" fill="none">
              <path d="M 20 40 L 98 38 M 20 56 L 100 54 M 20 72 L 86 71 M 20 88 L 96 86" />
            </g>
          )}
          <text
            x={W / 2}
            y={empty ? 112 : 124}
            fill={OUTLINE}
            fontFamily="'Trebuchet MS', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif"
            fontSize={empty ? 11.5 : 13}
            fontWeight="700"
            textAnchor="middle"
          >
            {empty
              ? <><tspan x={W / 2} dy="0">Pin your</tspan><tspan x={W / 2} dy="15">first piece</tspan></>
              : label}
          </text>
        </g>

        {/* thumbtack */}
        <g stroke={OUTLINE} strokeWidth="3" strokeLinecap="round">
          <line x1={cx} y1={pad + 14} x2={cx} y2={pad + 21} />
          <circle cx={cx} cy={pad + 4} r="10" fill="#E24B4A" />
          <circle cx={cx - 3} cy={pad + 1} r="2.5" fill="#F7C1C1" stroke="none" />
        </g>
      </svg>
    </div>
  )
}
