import { useState, useRef, useEffect } from 'react'
import { olSearch } from '../lib/olSearch'

// One search field for picking a book. Typing searches the Open Library
// catalog (same shared, cached lookup as the homepage and /search) and shows a
// dropdown with covers. Choosing a result fills BOTH the title and the author,
// so there's no separate author field. Typing without choosing keeps the typed
// title and clears the author.
//
// Props:
//   title, author : current values
//   onChange      : ({ title, author }) => void
//   placeholder   : input placeholder

export default function BookPicker({ title = '', author = '', onChange, placeholder = 'Search for a book' }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef(null)
  const seq = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  function type(val) {
    onChange?.({ title: val, author: '' }) // a fresh query no longer matches a picked author
    setActive(-1)
    clearTimeout(timer.current)
    const q = val.trim()
    if (q.length < 2) { setResults([]); setOpen(false); setLoading(false); return }
    setLoading(true); setOpen(true)
    const mine = ++seq.current
    timer.current = setTimeout(async () => {
      const hits = await olSearch(q)
      if (mine !== seq.current) return // a newer keystroke won
      setResults(hits.slice(0, 6))
      setLoading(false)
    }, 300)
  }

  function choose(b) {
    seq.current++ // drop any in-flight search
    clearTimeout(timer.current)
    onChange?.({ title: b.title, author: b.author || '' })
    setResults([]); setOpen(false); setLoading(false); setActive(-1)
  }

  function onKey(e) {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const showList = open && (loading || results.length > 0 || title.trim().length >= 2)

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="field-input"
        value={title}
        onChange={e => type(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => { if (results.length) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on a result land first
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {author && !open && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>
          <span>by <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{author}</strong></span>
          <button type="button" onClick={() => onChange?.({ title, author: '' })} aria-label="Clear author"
            style={{ background: 'none', border: 'none', color: 'var(--txD)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {showList && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {loading && <div style={{ padding: '14px 16px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Searching…</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: '14px 16px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>No matches. We'll save it as you typed it.</div>
          )}
          {!loading && results.map((b, i) => (
            <div key={b.key || b.title + i} role="option" aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); choose(b) }}
              onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: i === active ? 'var(--bg)' : 'transparent', borderTop: i ? '1px solid var(--bd)' : 'none' }}>
              {b.cover
                ? <img src={`https://covers.openlibrary.org/b/id/${b.cover}-S.jpg`} alt="" width={30} height={45} style={{ objectFit: 'cover', borderRadius: 3, flexShrink: 0, background: 'var(--bd)' }} />
                : <div style={{ width: 30, height: 45, borderRadius: 3, background: 'var(--bd)', flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[b.author, b.year].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
