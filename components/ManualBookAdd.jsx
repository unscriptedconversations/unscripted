import { useState } from 'react'
import { olLookupIsbn } from '../lib/olSearch'

// Shared "add a book by ISBN" panel for the club-creation form and the
// add-book modal on a club page. ISBN-driven: the reader enters an ISBN, we try
// to resolve it via Open Library, and either prefill the details or let them
// type the title/author while still keeping the ISBN. Every book from here is
// tagged source:'user_isbn'. (Books with no ISBN are a separate, vetted flow —
// not handled here.)
//
// The panel only IDENTIFIES a book; it calls onResolve({ title, author, isbn,
// book_key, cover, source }) and the parent owns persistence (club, chapters,
// added_by, etc.).

const label = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
const input = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }
const primary = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 22px', cursor: 'pointer' }
const ghost = { ...primary, color: 'var(--ink)', background: 'transparent', border: '1px solid var(--bd2)' }
const note = { fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.5 }

function cleanIsbn(v) {
  return String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

export default function ManualBookAdd({ onResolve }) {
  const [isbn, setIsbn] = useState('')
  const [phase, setPhase] = useState('idle') // idle | looking | found | manual
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState(null)
  const [bookKey, setBookKey] = useState(null)

  const cleaned = cleanIsbn(isbn)
  const isbnValid = cleaned.length === 10 || cleaned.length === 13
  const canUse = isbnValid && title.trim().length > 0

  async function lookup() {
    if (!isbnValid || phase === 'looking') return
    setPhase('looking')
    const book = await olLookupIsbn(cleaned)
    if (book) {
      setTitle(book.title || '')
      setAuthor(book.author || '')
      setCover(book.cover || null)
      setBookKey(book.book_key || book.key || null)
      setPhase('found')
    } else {
      setTitle('')
      setAuthor('')
      setCover(null)
      setBookKey(null)
      setPhase('manual')
    }
  }

  function use() {
    if (!canUse) return
    onResolve({
      title: title.trim(),
      author: author.trim(),
      isbn: cleaned,
      book_key: bookKey,
      cover: cover || null,
      source: 'user_isbn',
    })
  }

  return (
    <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, padding: 20 }}>
      <label style={label}>Add by ISBN</label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          style={input}
          value={isbn}
          onChange={e => { setIsbn(e.target.value); if (phase !== 'idle') setPhase('idle') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
          placeholder="978… or 10-digit ISBN"
          inputMode="numeric"
          aria-label="ISBN"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={!isbnValid || phase === 'looking'}
          style={{ ...ghost, whiteSpace: 'nowrap', opacity: (!isbnValid || phase === 'looking') ? 0.5 : 1 }}
        >
          {phase === 'looking' ? 'Looking…' : 'Look up'}
        </button>
      </div>

      {phase === 'manual' && (
        <div style={{ ...note, marginTop: 12 }}>
          No match for that ISBN. Enter the title and author yourself — the ISBN stays attached.
        </div>
      )}

      {(phase === 'found' || phase === 'manual') && (
        <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
          {cover && (
            <img
              src={`https://covers.openlibrary.org/b/id/${cover}-M.jpg`}
              alt=""
              style={{ width: 56, height: 82, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <input style={{ ...input, marginBottom: 10 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
            <input style={input} value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author" aria-label="Author" />
          </div>
        </div>
      )}

      {(phase === 'found' || phase === 'manual') && (
        <button
          type="button"
          onClick={use}
          disabled={!canUse}
          style={{ ...primary, marginTop: 16, width: '100%', opacity: canUse ? 1 : 0.5 }}
        >
          Use this book
        </button>
      )}
    </div>
  )
}
