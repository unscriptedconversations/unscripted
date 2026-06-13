/**
 * BookSearch — universal book search component for unscripted
 *
 * Props:
 *   value        {object|null}  — selected book: { title, author, year, cover, openLibraryKey }
 *   onChange     {function}     — called with the selected book object (or null to clear)
 *   placeholder  {string}       — input placeholder text
 *   label        {string}       — field label (default: "Search for a book")
 *   showChapters {boolean}      — show chapter count + "no numbered chapters" UI after selection
 *   chaptersValue {string}      — controlled chapters value
 *   onChaptersChange {function} — called with new chapters string
 *   noChapters   {boolean}      — controlled "no numbered chapters" checkbox
 *   onNoChaptersChange {function} — called with boolean
 *   autoFocus    {boolean}
 *   style        {object}       — wrapper style overrides
 *
 * Usage (minimal):
 *   <BookSearch value={book} onChange={setBook} />
 *
 * Usage (with chapter controls, e.g. club creation):
 *   <BookSearch
 *     value={book}
 *     onChange={setBook}
 *     showChapters
 *     chaptersValue={chapters}
 *     onChaptersChange={setChapters}
 *     noChapters={noChapters}
 *     onNoChaptersChange={setNoChapters}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Open Library search ──────────────────────────────────────────────────────

async function fetchBooks(query) {
  const url =
    `https://openlibrary.org/search.json` +
    `?q=${encodeURIComponent(query)}` +
    `&limit=7` +
    `&fields=title,author_name,first_publish_year,cover_i,key,edition_count`
  const res = await fetch(url)
  const data = await res.json()
  return (data.docs || []).map((b) => ({
    title: b.title,
    author: (b.author_name || [])[0] || 'Unknown',
    year: b.first_publish_year || null,
    cover: b.cover_i
      ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`
      : null,
    coverSmall: b.cover_i
      ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg`
      : null,
    openLibraryKey: b.key || null,
    editionCount: b.edition_count || null,
  }))
}

// ─── Styles (matching unscripted design system) ───────────────────────────────

const S = {
  wrapper: {
    position: 'relative',
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
  },
  label: {
    display: 'block',
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'var(--txD, #8A8578)',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    padding: '14px 18px 14px 44px',
    background: 'var(--bg, #F5F1EB)',
    border: '1px solid var(--bd2, rgba(20,25,38,0.12))',
    borderRadius: 10,
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 15,
    color: 'var(--ink, #1A1F2E)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  inputFocused: {
    borderColor: 'var(--tc, #C27A5A)',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: 'var(--txD, #8A8578)',
    fontSize: 16,
    lineHeight: 1,
  },
  clearBtn: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--txD, #8A8578)',
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: 'var(--sf, #FFFFFF)',
    border: '1px solid var(--bd2, rgba(20,25,38,0.12))',
    borderRadius: 14,
    boxShadow: '0 16px 40px rgba(0,0,0,0.10)',
    zIndex: 100,
    maxHeight: 340,
    overflowY: 'auto',
    scrollbarWidth: 'none',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--bd, rgba(20,25,38,0.07))',
    transition: 'background 0.12s',
  },
  dropdownItemHovered: {
    background: 'var(--sf2, #F0EBE2)',
  },
  coverThumb: {
    width: 30,
    height: 44,
    borderRadius: 4,
    objectFit: 'cover',
    flexShrink: 0,
    background: 'var(--sf2, #F0EBE2)',
  },
  coverPlaceholder: {
    width: 30,
    height: 44,
    borderRadius: 4,
    flexShrink: 0,
    background: 'var(--sf2, #F0EBE2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  itemTitle: {
    fontFamily: "var(--hd, 'Cormorant Garamond', Georgia, serif)",
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ink, #1A1F2E)',
    lineHeight: 1.25,
    marginBottom: 2,
  },
  itemMeta: {
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 11,
    color: 'var(--txD, #8A8578)',
    lineHeight: 1.4,
  },
  statusRow: {
    padding: '14px 18px',
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 13,
    color: 'var(--txD, #8A8578)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  // Selected book card
  selectedCard: {
    background: 'var(--sf2, #F0EBE2)',
    borderRadius: 12,
    padding: '18px 20px',
    marginTop: 12,
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    position: 'relative',
  },
  selectedCover: {
    width: 52,
    height: 74,
    borderRadius: 6,
    objectFit: 'cover',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  selectedCoverPlaceholder: {
    width: 52,
    height: 74,
    borderRadius: 6,
    flexShrink: 0,
    background: 'linear-gradient(145deg, #C27A5A, #D4956A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  selectedTitle: {
    fontFamily: "var(--hd, 'Cormorant Garamond', Georgia, serif)",
    fontSize: 18,
    fontWeight: 600,
    fontStyle: 'italic',
    color: 'var(--ink, #1A1F2E)',
    lineHeight: 1.2,
    marginBottom: 4,
  },
  selectedAuthor: {
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 12,
    color: 'var(--txM, #5E5A50)',
    marginBottom: 4,
  },
  selectedYear: {
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 11,
    color: 'var(--txD, #8A8578)',
  },
  changeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'var(--txD, #8A8578)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  // Chapter controls
  chapterBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid var(--bd, rgba(20,25,38,0.07))',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 13,
    color: 'var(--ink, #1A1F2E)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: 'var(--tc, #C27A5A)',
    cursor: 'pointer',
  },
  chapterInputWrap: {
    marginTop: 12,
  },
  chapterLabel: {
    display: 'block',
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'var(--txD, #8A8578)',
    marginBottom: 8,
  },
  chapterInput: {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg, #F5F1EB)',
    border: '1px solid var(--bd2, rgba(20,25,38,0.12))',
    borderRadius: 8,
    fontFamily: "var(--ui, 'Outfit', sans-serif)",
    fontSize: 15,
    color: 'var(--ink, #1A1F2E)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid var(--bd2, rgba(20,25,38,0.12))',
    borderTopColor: 'var(--tc, #C27A5A)',
    borderRadius: '50%',
    animation: 'booksearch-spin 0.6s linear infinite',
  },
}

// ─── Spinner keyframes injected once ─────────────────────────────────────────

let spinnerInjected = false
function injectSpinnerCSS() {
  if (spinnerInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = `@keyframes booksearch-spin { to { transform: rotate(360deg); } }`
  document.head.appendChild(style)
  spinnerInjected = true
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookSearch({
  value = null,
  onChange,
  placeholder = 'Start typing a title or author...',
  label = 'Search for a book',
  showChapters = false,
  chaptersValue = '',
  onChaptersChange,
  noChapters = false,
  onNoChaptersChange,
  autoFocus = false,
  style = {},
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const [error, setError] = useState(null)

  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => { injectSpinnerCSS() }, [])

  // Close dropdown on outside click
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

  const search = useCallback((val) => {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.trim().length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    timerRef.current = setTimeout(async () => {
      try {
        const books = await fetchBooks(val.trim())
        setResults(books)
      } catch (e) {
        setError('Search unavailable. Try again.')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 380)
  }, [])

  function select(book) {
    onChange?.(book)
    setQuery('')
    setResults([])
    setHoveredIdx(-1)
  }

  function clear() {
    onChange?.(null)
    setQuery('')
    setResults([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Keyboard navigation
  function handleKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoveredIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoveredIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && hoveredIdx >= 0) {
      e.preventDefault()
      select(results[hoveredIdx])
    } else if (e.key === 'Escape') {
      setResults([])
      setQuery('')
    }
  }

  const showDropdown = (loading || results.length > 0 || error) && query.length >= 2

  // ── If a book is selected, show the card instead of the input ──────────────
  if (value) {
    return (
      <div style={{ ...S.wrapper, ...style }}>
        {label && <span style={S.label}>{label}</span>}
        <div style={S.selectedCard}>
          {value.cover
            ? <img src={value.coverSmall || value.cover} style={S.selectedCover} alt="" />
            : <div style={S.selectedCoverPlaceholder}>📖</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.selectedTitle}>{value.title}</div>
            <div style={S.selectedAuthor}>{value.author}</div>
            {value.year && <div style={S.selectedYear}>{value.year}</div>}
          </div>
          <button style={S.changeBtn} onClick={clear} type="button">Change</button>
        </div>

        {showChapters && (
          <div style={S.chapterBlock}>
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={noChapters}
                onChange={(e) => onNoChaptersChange?.(e.target.checked)}
                style={S.checkbox}
              />
              No numbered chapters
            </label>
            {!noChapters && (
              <div style={S.chapterInputWrap}>
                <label style={S.chapterLabel}>How many chapters?</label>
                <input
                  style={S.chapterInput}
                  type="number"
                  min="1"
                  max="999"
                  placeholder="e.g. 12"
                  value={chaptersValue}
                  onChange={(e) => onChaptersChange?.(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Search input + dropdown ────────────────────────────────────────────────
  return (
    <div style={{ ...S.wrapper, ...style }}>
      {label && <span style={S.label}>{label}</span>}

      <div style={{ position: 'relative' }}>
        <span style={{ ...S.searchIcon, top: focused ? '50%' : '50%' }}>🔍</span>
        <input
          ref={inputRef}
          style={{ ...S.input, ...(focused ? S.inputFocused : {}) }}
          type="text"
          placeholder={placeholder}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button style={S.clearBtn} onClick={clear} type="button" tabIndex={-1}>×</button>
        )}
      </div>

      {showDropdown && (
        <div ref={dropdownRef} style={S.dropdown}>
          {loading && (
            <div style={S.statusRow}>
              <span style={S.spinner} />
              Searching Open Library...
            </div>
          )}
          {error && !loading && (
            <div style={{ ...S.statusRow, color: '#A0603E' }}>{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.length >= 2 && (
            <div style={S.statusRow}>No results for "{query}"</div>
          )}
          {!loading && results.map((b, i) => (
            <div
              key={i}
              style={{
                ...S.dropdownItem,
                ...(hoveredIdx === i ? S.dropdownItemHovered : {}),
                borderBottom: i === results.length - 1 ? 'none' : S.dropdownItem.borderBottom,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(-1)}
              onMouseDown={(e) => { e.preventDefault(); select(b) }}
            >
              {b.coverSmall
                ? <img src={b.coverSmall} style={S.coverThumb} alt="" onError={(e) => { e.target.style.display = 'none' }} />
                : <div style={S.coverPlaceholder}>📖</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.itemTitle}>{b.title}</div>
                <div style={S.itemMeta}>
                  {b.author}
                  {b.year ? ` · ${b.year}` : ''}
                  {b.editionCount > 1 ? ` · ${b.editionCount} editions` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
