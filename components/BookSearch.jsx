import { useState, useRef, useEffect } from 'react'

async function fetchBooks(query) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=7&fields=title,author_name,first_publish_year,cover_i,key,edition_count`
  const res = await fetch(url)
  const data = await res.json()
  return (data.docs || []).map((b) => ({
    title: b.title,
    author: (b.author_name || [])[0] || 'Unknown',
    year: b.first_publish_year || null,
    cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
    coverSmall: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null,
    openLibraryKey: b.key || null,
    editionCount: b.edition_count || null,
  }))
}

export default function BookSearch({
  value,
  onChange,
  placeholder,
  label,
  showChapters,
  chaptersValue,
  onChaptersChange,
  noChapters,
  onNoChaptersChange,
  style,
}) {
  placeholder = placeholder || 'Start typing a title or author...'
  label = label || 'Search for a book'
  showChapters = showChapters || false
  chaptersValue = chaptersValue || ''
  noChapters = noChapters || false
  style = style || {}

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const [error, setError] = useState(null)

  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setResults([])
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function search(val) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    timerRef.current = setTimeout(async () => {
      try {
        const books = await fetchBooks(val.trim())
        setResults(books)
      } catch (e) {
        setError('Search unavailable. Try again.')
        setResults([])
      }
      setLoading(false)
    }, 380)
  }

  function select(book) {
    if (onChange) onChange(book)
    setQuery('')
    setResults([])
    setHoveredIdx(-1)
  }

  function clear() {
    if (onChange) onChange(null)
    setQuery('')
    setResults([])
    setTimeout(() => { if (inputRef.current) inputRef.current.focus() }, 0)
  }

  function handleKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoveredIdx(function(i) { return Math.min(i + 1, results.length - 1) })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoveredIdx(function(i) { return Math.max(i - 1, 0) })
    } else if (e.key === 'Enter' && hoveredIdx >= 0) {
      e.preventDefault()
      select(results[hoveredIdx])
    } else if (e.key === 'Escape') {
      setResults([])
      setQuery('')
    }
  }

  const fl = {
    display: 'block',
    fontFamily: 'var(--ui)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'var(--txD)',
    marginBottom: 10,
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 18px 14px 44px',
    background: 'var(--bg)',
    border: focused ? '1px solid var(--tc)' : '1px solid var(--bd2)',
    borderRadius: 10,
    fontFamily: 'var(--ui)',
    fontSize: 15,
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const showDropdown = (loading || results.length > 0 || error) && query.length >= 2

  if (value) {
    return (
      <div style={Object.assign({ position: 'relative', fontFamily: 'var(--ui)' }, style)}>
        {label && <span style={fl}>{label}</span>}
        <div style={{ background: 'var(--sf2)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
          {value.cover
            ? <img src={value.coverSmall || value.cover} style={{ width: 48, height: 68, borderRadius: 6, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} alt="" />
            : <div style={{ width: 48, height: 68, borderRadius: 6, flexShrink: 0, background: 'linear-gradient(145deg,#C27A5A,#D4956A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📖</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.2, marginBottom: 4 }}>{value.title}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txM)', marginBottom: 4 }}>{value.author}</div>
            {value.year && <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{value.year}</div>}
          </div>
          <button onClick={clear} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--txD)', padding: 0, position: 'absolute', top: 14, right: 14 }}>Change</button>
        </div>

        {showChapters && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={noChapters}
                onChange={function(e) { if (onNoChaptersChange) onNoChaptersChange(e.target.checked) }}
                style={{ width: 16, height: 16, accentColor: 'var(--tc)', cursor: 'pointer' }}
              />
              No numbered chapters
            </label>
            {!noChapters && (
              <div style={{ marginTop: 12 }}>
                <label style={fl}>How many chapters?</label>
                <input
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 8, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                  type="number"
                  min="1"
                  max="999"
                  placeholder="e.g. 12"
                  value={chaptersValue}
                  onChange={function(e) { if (onChaptersChange) onChaptersChange(e.target.value) }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={Object.assign({ position: 'relative', fontFamily: 'var(--ui)' }, style)}>
      {label && <span style={fl}>{label}</span>}

      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 16 }}>🔍</span>
        <input
          ref={inputRef}
          style={inputStyle}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={function(e) { search(e.target.value) }}
          onFocus={function() { setFocused(true) }}
          onBlur={function() { setFocused(false) }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--txD)', padding: 0, lineHeight: 1 }}
            onClick={clear}
            type="button"
            tabIndex={-1}
          >×</button>
        )}
      </div>

      {showDropdown && (
        <div ref={dropdownRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.10)', zIndex: 100, maxHeight: 340, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '14px 18px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Searching...</div>
          )}
          {error && !loading && (
            <div style={{ padding: '14px 18px', fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E' }}>{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.length >= 2 && (
            <div style={{ padding: '14px 18px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>No results for "{query}"</div>
          )}
          {!loading && results.map(function(b, i) {
            return (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', cursor: 'pointer', borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--bd)', background: hoveredIdx === i ? 'var(--sf2)' : 'transparent' }}
                onMouseEnter={function() { setHoveredIdx(i) }}
                onMouseLeave={function() { setHoveredIdx(-1) }}
                onMouseDown={function(e) { e.preventDefault(); select(b) }}
              >
                {b.coverSmall
                  ? <img src={b.coverSmall} style={{ width: 30, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} alt="" onError={function(e) { e.target.style.display = 'none' }} />
                  : <div style={{ width: 30, height: 44, borderRadius: 4, flexShrink: 0, background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📖</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 2 }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>
                    {b.author}{b.year ? ' · ' + b.year : ''}{b.editionCount > 1 ? ' · ' + b.editionCount + ' editions' : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
