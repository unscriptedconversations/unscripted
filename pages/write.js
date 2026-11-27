// pages/write.js — the writing editor
//
// A blank-page canvas (title, optional subtitle, body) with autosave for
// drafts. Everything about publishing (format, themes, club tag, a card
// preview) lives in the Publish panel, so the writing screen stays clean.
//   - Drafts autosave a couple of seconds after you stop typing (once there's
//     a title). Published pieces never autosave: edits go live only when you
//     press Update.
//   - Saves check for errors and say so; nothing claims "Saved" unless it was.
//   - Optional cover image (Supabase Storage bucket "covers", your own folder).
//   - The first publish of a piece emails it to the writer's followers
//     (pages/api/writing-email.js; once per piece, never on updates).
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import TopNav from '../components/TopNav'
import { renderRich, plainText } from '../lib/formatText'

const REFLECTION_MAX = 300
const AUTOSAVE_MS = 2500
const WORDS_PER_MIN = 230
const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const FORMATS = [
  { id: 'reflection', label: 'Reflection', desc: `A few paragraphs · up to ${REFLECTION_MAX} words` },
  { id: 'essay', label: 'Essay', desc: 'Long-form' },
]

function words(t) { return t.trim() ? t.trim().split(/\s+/).length : 0 }
function timeLabel(d) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

// Textarea that grows with its content (no inner scrollbar)
function AutoGrow({ value, onChange, style, placeholder, ariaLabel, onKeyDown, inputRef }) {
  const local = useRef(null)
  const ref = inputRef || local
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value, ref])
  return <textarea ref={ref} rows={1} aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={onKeyDown}
    style={{ width: '100%', border: 'none', outline: 'none', background: 'none', resize: 'none', overflow: 'hidden', padding: 0, display: 'block', ...style }} />
}

export default function Write() {
  const router = useRouter()
  const { id } = router.query
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [myClubs, setMyClubs] = useState([])
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [content, setContent] = useState('')
  const [format, setFormat] = useState('reflection')
  const [clubId, setClubId] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState('')
  const [writingId, setWritingId] = useState(null)
  const [isPublished, setIsPublished] = useState(false)
  const [loaded, setLoaded] = useState(false)             // an existing piece has loaded (or this is a new one)
  const [dirty, setDirty] = useState(false)               // changes since the last successful save
  const [status, setStatus] = useState('idle')            // idle | saving | saved | error
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [preview, setPreview] = useState(false)          // show the body formatted, as readers will see it
  const [publishing, setPublishing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState('')
  const [draftCount, setDraftCount] = useState(0)
  const [pubCount, setPubCount] = useState(0)
  const [justPublished, setJustPublished] = useState(null) // { id, title, club } after Publish
  const [aiReady, setAiReady] = useState(false)
  const bodyRef = useRef(null)
  const saveTimer = useRef(null)
  const inFlight = useRef(false)
  const latest = useRef({})                                 // newest values for the autosave timer

  // Only offer "Suggest themes" when AI is on. /api/themes answers an empty
  // request with { disabled: true } when ANTHROPIC_API_KEY is unset.
  useEffect(() => {
    let live = true
    fetch('/api/themes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json()).then(d => { if (live && !d.disabled) setAiReady(true) }).catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: u } = await supabase.from('members').select('*').eq('id', session.user.id).single()
        if (u) { setCurrentUser(u); loadMyClubs(u.id); loadCounts(u.id) }
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    // The address gains ?id= after the first autosave; that piece is already open, so don't reload it
    if (id && id !== latest.current.writingId) loadWriting(id)
    else if (!id) setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, id])

  // Prefill the book title as a starting theme when arriving from a book page
  // (/write?about=Title). New pieces only; never clobber an existing draft.
  useEffect(() => {
    if (!router.isReady || id) return
    const about = Array.isArray(router.query.about) ? router.query.about[0] : router.query.about
    if (about) setTagsInput(prev => prev || String(about))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  // Keep the newest values where the autosave timer can see them
  latest.current = { title, subtitle, content, format, clubId, tagsInput, coverUrl, writingId, isPublished, currentUser }

  // Autosave drafts a moment after typing stops (needs a title)
  useEffect(() => {
    if (!loaded || !dirty || isPublished || !currentUser) return
    if (!title.trim()) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { persist(false, { auto: true }) }, AUTOSAVE_MS)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, content, tagsInput, clubId, format, coverUrl, dirty, loaded, isPublished, currentUser])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function onLeave(e) { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  async function loadCounts(memberId) {
    const [d, p] = await Promise.all([
      supabase.from('writings').select('id', { count: 'exact', head: true }).eq('member_id', memberId).eq('is_published', false),
      supabase.from('writings').select('id', { count: 'exact', head: true }).eq('member_id', memberId).eq('is_published', true),
    ])
    setDraftCount(d.count || 0)
    setPubCount(p.count || 0)
  }

  async function loadMyClubs(memberId) {
    const { data } = await supabase.from('club_members').select('club:clubs(id, name)').eq('member_id', memberId)
    if (data) setMyClubs(data.map(d => d.club).filter(Boolean))
  }

  async function loadWriting(wid) {
    const { data } = await supabase.from('writings').select('*').eq('id', wid).single()
    if (data) {
      setWritingId(data.id)
      setTitle(data.title || '')
      setSubtitle(data.subtitle || '')
      setContent(data.content || '')
      setFormat(data.format || 'reflection')
      setClubId(data.club_id || '')
      setTagsInput((data.tags || []).join(', '))
      setCoverUrl(data.cover_url || '')
      setIsPublished(!!data.is_published)
      if (data.updated_at) { setSavedAt(new Date(data.updated_at)); setStatus('saved') }
    }
    setDirty(false)
    setLoaded(true)
  }

  // Formatting toolbar. Wraps the selection in markers (bold, italic, link) or
  // prefixes the selected lines (heading, quote). Same markers lib/formatText reads.
  function applyBody(next, selStart, selEnd) {
    setContent(next); setDirty(true)
    requestAnimationFrame(() => { const el = bodyRef.current; if (el) { el.focus(); el.setSelectionRange(selStart, selEnd) } })
  }
  function wrap(before, after, placeholder) {
    const el = bodyRef.current
    if (!el) return
    const a = el.selectionStart, b = el.selectionEnd
    const sel = content.slice(a, b) || placeholder
    const next = content.slice(0, a) + before + sel + after + content.slice(b)
    applyBody(next, a + before.length, a + before.length + sel.length)
  }
  function prefixLines(prefix) {
    const el = bodyRef.current
    if (!el) return
    const a = content.lastIndexOf('\n', el.selectionStart - 1) + 1
    let b = content.indexOf('\n', el.selectionEnd)
    if (b === -1) b = content.length
    const lines = content.slice(a, b).split('\n')
    const allHave = lines.every(l => l.startsWith(prefix))
    const changed = lines.map(l => allHave ? l.slice(prefix.length) : prefix + l.replace(/^(#{1,3} |> )/, '')).join('\n')
    applyBody(content.slice(0, a) + changed + content.slice(b), a, a + changed.length)
  }
  function addLink() {
    const el = bodyRef.current
    if (!el) return
    const a = el.selectionStart, b = el.selectionEnd
    const label = content.slice(a, b) || 'link text'
    const insert = `[${label}](https://)`
    const urlStart = a + label.length + 3
    applyBody(content.slice(0, a) + insert + content.slice(b), urlStart, urlStart + 8)
  }
  function addBreak() {
    const el = bodyRef.current
    if (!el) return
    const a = el.selectionEnd
    const before = content.slice(0, a).replace(/\s*$/, '')
    const insert = (before ? '\n\n' : '') + '---\n\n'
    const next = before + insert + content.slice(a).replace(/^\s*/, '')
    applyBody(next, before.length + insert.length, before.length + insert.length)
  }
  function onBodyKey(e) {
    if (!(e.metaKey || e.ctrlKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); wrap('**', '**', 'bold text') }
    else if (k === 'i') { e.preventDefault(); wrap('*', '*', 'italic text') }
    else if (k === 'k') { e.preventDefault(); addLink() }
  }

  function edit(setter) { return e => { setter(e.target.value); setDirty(true); if (status === 'error') setStatus('idle') } }

  // Save the piece. publish=false keeps it a draft (or moves a published piece
  // back to drafts); publish=true publishes or updates it.
  async function persist(publish, { auto = false } = {}) {
    const v = { ...latest.current }   // snapshot: the live object changes as the save completes
    if (!v.currentUser || !v.title.trim()) return false
    if (inFlight.current) { if (auto) { saveTimer.current = setTimeout(() => persist(false, { auto: true }), 800) } return false }
    inFlight.current = true
    setStatus('saving'); setSaveError('')
    const payload = {
      member_id: v.currentUser.id,
      title: v.title.trim(),
      subtitle: v.subtitle.trim() || null,
      content: v.content.trim(),
      format: v.format,
      club_id: v.clubId || null,
      cover_url: v.coverUrl || null,
      tags: v.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      is_published: publish,
      updated_at: new Date().toISOString(),
    }
    // Keep the original publish date when updating a published piece
    if (!(publish && v.isPublished)) payload.published_at = publish ? new Date().toISOString() : null
    let savedId = v.writingId
    let err = null
    if (v.writingId) {
      const { data, error } = await supabase.from('writings').update(payload).eq('id', v.writingId).select('id')
      err = error || (!data?.length ? { message: 'No changes were saved.', code: 'NOT_SAVED' } : null)
    } else {
      const { data, error } = await supabase.from('writings').insert(payload).select('id').single()
      err = error || (!data ? { message: 'No changes were saved.', code: 'NOT_SAVED' } : null)
      if (data) {
        savedId = data.id
        setWritingId(data.id)
        latest.current.writingId = data.id
        router.replace(`/write?id=${data.id}`, undefined, { shallow: true })
      }
    }
    inFlight.current = false
    if (err) {
      setStatus('error')
      setSaveError(`Couldn’t ${publish ? 'publish' : 'save'}. Your text is still here, so please try again.` + (err.code ? ` (Error code: ${err.code})` : ''))
      return false
    }
    // Only clear "unsaved" if nothing changed while this save was running
    const now = latest.current
    if (now.title === v.title && now.subtitle === v.subtitle && now.content === v.content && now.tagsInput === v.tagsInput && now.clubId === v.clubId && now.format === v.format && now.coverUrl === v.coverUrl) setDirty(false)
    setIsPublished(publish)
    latest.current.isPublished = publish
    setSavedAt(new Date()); setStatus('saved')
    loadCounts(v.currentUser.id)
    // First publish only: email followers (fire-and-forget; the server also
    // refuses to send the same piece twice)
    if (publish && !v.isPublished && savedId) notifyFollowers(savedId)
    if (publish && savedId) {
      setPublishOpen(false)
      setJustPublished({ id: savedId, title: v.title.trim(), club: myClubs.find(c => c.id === v.clubId) || null })
      window.scrollTo(0, 0)
    }
    return true
  }

  async function notifyFollowers(wid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      fetch('/api/writing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ writingId: wid }),
      }).catch(() => {})
    } catch (e) { /* never block publishing */ }
  }

  async function uploadCover(file) {
    if (!file || !currentUser) return
    setCoverError('')
    if (!COVER_TYPES.includes(file.type)) { setCoverError('Please choose a JPG, PNG, WebP or GIF image.'); return }
    if (file.size > COVER_MAX_BYTES) { setCoverError('That image is over 5 MB. Please choose a smaller one.'); return }
    setCoverBusy(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
    const path = `${currentUser.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file, { contentType: file.type, upsert: false })
    setCoverBusy(false)
    if (error) { setCoverError('Sorry, the image couldn\u2019t be uploaded. Please try again.'); return }
    const { data } = supabase.storage.from('covers').getPublicUrl(path)
    if (data?.publicUrl) { setCoverUrl(data.publicUrl); setDirty(true) }
  }

  async function publishNow() {
    setPublishing(true)
    await persist(true)
    setPublishing(false)
  }

  // AI theme suggestions (dormant until ANTHROPIC_API_KEY is set). Suggestions
  // merge into the editable themes field; never auto-applied.
  async function suggestThemes() {
    if (suggesting) return
    if (content.trim().length < 200) { setSuggestNote('Write a little more first.'); return }
    setSuggesting(true); setSuggestNote('')
    try {
      const r = await fetch('/api/themes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, content }) })
      const d = await r.json()
      const themes = Array.isArray(d.themes) ? d.themes : []
      if (!themes.length) { setSuggestNote('No suggestions right now.'); setSuggesting(false); return }
      const existing = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const seen = new Set(existing.map(t => t.toLowerCase()))
      const merged = [...existing]
      for (const th of themes) { const k = th.toLowerCase(); if (!seen.has(k)) { seen.add(k); merged.push(th) } }
      setTagsInput(merged.join(', ')); setDirty(true)
      setSuggestNote(`Added ${themes.length} suggested theme${themes.length !== 1 ? 's' : ''}. Edit as you like.`)
    } catch {
      setSuggestNote('Couldn’t suggest themes just now.')
    }
    setSuggesting(false)
  }

  // Start a fresh piece in place (after publishing)
  function writeAnother() {
    setJustPublished(null); setWritingId(null); setIsPublished(false)
    setTitle(''); setSubtitle(''); setContent(''); setTagsInput(''); setClubId(''); setFormat('reflection'); setCoverUrl(''); setCoverError('')
    setSuggestNote(''); setDirty(false); setStatus('idle'); setSavedAt(null); setSaveError('')
    router.replace('/write', undefined, { shallow: true })
    window.scrollTo(0, 0)
  }

  const wordCount = words(plainText(content))
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MIN))
  const overLimit = format === 'reflection' && wordCount > REFLECTION_MAX
  const canPublish = !!title.trim() && !!content.trim() && !overLimit
  const toWriting = () => router.push(`/profile/${currentUser.id}?tab=writing`)

  const btn = { fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }
  const btnO = { ...btn, color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', padding: '10px 18px' }
  const pill = { fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink)', background: 'var(--sf)', border: '1.5px solid var(--bd2)', borderRadius: 100, padding: '7px 14px', cursor: 'pointer' }
  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }
  const meta = { fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading{'…'}</div></div>

  if (!currentUser) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <title>Write — unscripted</title>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>You need an account to write.</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button style={btnO} onClick={() => router.push('/login?redirect=/write')}>Log in</button>
          <button style={btn} onClick={() => router.push('/signup')}>Join unscripted</button>
        </div>
      </div>
    </div>
  )

  if (justPublished) return (
    <div style={{ minHeight: '100vh' }}>
      <title>Published — unscripted</title>
      <TopNav />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 28px 80px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sg)', marginBottom: 14 }}>Published {'✓'}</div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.25, marginBottom: 12 }}>{justPublished.title}</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 32 }}>
          {justPublished.club ? <>It{'’'}s on your profile and shared with {justPublished.club.name}.</> : <>It{'’'}s live on your profile.</>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => router.push(`/writing/${justPublished.id}`)}>View piece</button>
          <button style={btnO} onClick={toWriting}>Go to your profile</button>
          {justPublished.club && <button style={btnO} onClick={() => router.push(`/club/${justPublished.club.id}`)}>Back to {justPublished.club.name}</button>}
        </div>
        <button onClick={writeAnother} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--tc)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 24 }}>Write another piece</button>
      </div>
    </div>
  )

  // Save status shown in the editor bar
  let statusText = ''
  if (status === 'saving') statusText = 'Saving…'
  else if (status === 'error') statusText = 'Not saved'
  else if (isPublished && dirty) statusText = 'Unpublished changes'
  else if (dirty && !title.trim()) statusText = 'Add a title to start saving'
  else if (dirty) statusText = 'Unsaved changes'
  else if (savedAt) statusText = `${isPublished ? 'Published' : 'Saved'} · ${timeLabel(savedAt)}`
  else if (!writingId) statusText = 'New draft'

  const plain = plainText(content).trim().replace(/\s+/g, ' ')
  const excerpt = plain.slice(0, 160) + (plain.length > 160 ? '\u2026' : '')

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{title.trim() ? `${title.trim()} — unscripted` : `${writingId ? 'Edit' : 'Write'} — unscripted`}</title>
      <TopNav />

      {/* Editor bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--bd)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button style={pill} onClick={toWriting}>Drafts ({draftCount})</button>
          <button style={pill} onClick={toWriting}>Published ({pubCount})</button>
          <div role="status" aria-live="polite" style={{ ...meta, marginLeft: 'auto', color: status === 'error' ? '#A0603E' : 'var(--txD)' }}>{statusText}</div>
          {!isPublished && dirty && title.trim() && status !== 'saving' && <button style={{ ...btnO, padding: '8px 14px' }} onClick={() => persist(false)}>Save</button>}
          <button style={{ ...btn, background: 'var(--tc)', opacity: canPublish ? 1 : 0.4 }} disabled={!canPublish || status === 'saving'}
            onClick={() => isPublished ? persist(true) : setPublishOpen(true)}>{isPublished ? 'Update' : 'Publish'}</button>
        </div>
        <div role="toolbar" aria-label="Formatting" style={{ maxWidth: 720, margin: '0 auto', padding: '0 28px 10px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {[
            ['B', 'Bold (Ctrl/\u2318 B)', () => wrap('**', '**', 'bold text'), { fontWeight: 800 }],
            ['I', 'Italic (Ctrl/\u2318 I)', () => wrap('*', '*', 'italic text'), { fontStyle: 'italic', fontFamily: 'var(--hd)', fontSize: 16 }],
            ['H', 'Heading', () => prefixLines('## '), { fontWeight: 700 }],
            ['\u201C', 'Quote', () => prefixLines('> '), { fontFamily: 'var(--hd)', fontSize: 20, lineHeight: '14px' }],
            ['Link', 'Link (Ctrl/\u2318 K)', addLink, { textDecoration: 'underline', fontSize: 12 }],
            ['\u2022\u2022\u2022', 'Section break', addBreak, { letterSpacing: 1, fontSize: 11 }],
          ].map(([label, tip, fn, st]) => (
            <button key={tip} type="button" title={tip} aria-label={tip} disabled={preview} onMouseDown={e => e.preventDefault()} onClick={fn}
              style={{ minWidth: 34, height: 30, padding: '0 8px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', background: 'none', border: '1px solid transparent', borderRadius: 6, cursor: preview ? 'default' : 'pointer', opacity: preview ? 0.35 : 1, ...st }}>{label}</button>
          ))}
          <button type="button" onClick={() => setPreview(p => !p)} aria-pressed={preview}
            style={{ marginLeft: 'auto', fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: preview ? '#FFF' : 'var(--ink)', background: preview ? 'var(--ink)' : 'none', border: '1.5px solid var(--bd2)', borderRadius: 100, padding: '6px 14px', cursor: 'pointer' }}>
            {preview ? 'Back to editing' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '44px 28px 120px' }}>
        {isPublished && <div style={{ ...meta, marginBottom: 18 }}>
          <span style={{ fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontSize: 10, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '5px 12px', marginRight: 10 }}>Published</span>
          Edits go live when you press Update.
        </div>}

        <AutoGrow ariaLabel="Title" placeholder="Title" value={title} onChange={edit(setTitle)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus() } }}
          style={{ fontFamily: 'var(--hd)', fontSize: 40, fontWeight: 600, lineHeight: 1.15, color: 'var(--ink)', marginBottom: 10 }} />
        <AutoGrow ariaLabel="Subtitle" placeholder="Add a subtitle (optional)" value={subtitle} onChange={edit(setSubtitle)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus() } }}
          style={{ fontFamily: 'var(--hd)', fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, color: 'var(--txD)', marginBottom: 28 }} />
        {preview ? (
          <div style={{ fontFamily: 'var(--hd)', fontSize: 21, lineHeight: 1.8, color: 'var(--ink)', minHeight: 320 }}>
            {content.trim() ? renderRich(content) : <div style={{ color: 'var(--txD)', fontStyle: 'italic' }}>Nothing to preview yet.</div>}
          </div>
        ) : (
          <AutoGrow ariaLabel="Body" inputRef={bodyRef} placeholder="Tell your story…" value={content} onChange={edit(setContent)} onKeyDown={onBodyKey}
            style={{ fontFamily: 'var(--hd)', fontSize: 21, lineHeight: 1.75, color: 'var(--ink)', minHeight: 320 }} />
        )}
        {!preview && wordCount === 0 && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginTop: 12, lineHeight: 1.6 }}>
          Tip: **bold**, *italic*, ## for a heading, &gt; for a quote, or use the toolbar above.
        </div>}

        <div style={{ ...meta, display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 28, flexWrap: 'wrap' }}>
          {overLimit && <span style={{ color: '#A0603E', marginRight: 'auto' }}>Over the {REFLECTION_MAX}-word Reflection limit. Trim it, or publish as an Essay.</span>}
          <span style={{ color: overLimit ? '#A0603E' : 'var(--txD)', fontWeight: 600 }}>{wordCount}{format === 'reflection' ? ` / ${REFLECTION_MAX}` : ''} {wordCount === 1 ? 'word' : 'words'}</span>
          <span>{minutes} min read</span>
        </div>
        {saveError && <div role="alert" style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 14, textAlign: 'right', lineHeight: 1.6 }}>{saveError}</div>}

        {/* Published-piece and delete options */}
        {writingId && <div style={{ marginTop: 56, paddingTop: 20, borderTop: '1px solid var(--bd)', display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isPublished && <button onClick={() => setPublishOpen(true)} style={{ ...meta, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>Edit format, themes and club</button>}
          {isPublished && <button onClick={() => persist(false)} style={{ ...meta, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>Move to drafts</button>}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ ...meta, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              Delete this {isPublished ? 'piece' : 'draft'}
            </button>
          ) : (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', textAlign: 'center', width: '100%' }}>
              <div style={{ marginBottom: 12 }}>Delete {title.trim() ? <em>{title.trim()}</em> : 'this piece'} for good? This can{'’'}t be undone.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button style={btnO} disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button style={{ ...btn, background: '#A0603E' }} disabled={deleting} onClick={async () => {
                  setDeleting(true)
                  const { error } = await supabase.rpc('remove_content', { p_kind: 'writing', p_id: writingId })
                  setDeleting(false)
                  if (error) { window.alert('Sorry, that couldn’t be deleted. Please try again.'); return }
                  setDirty(false)
                  router.push(`/profile/${currentUser.id}?tab=writing`)
                }}>{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </div>
          )}
        </div>}
      </div>

      {/* Publish panel */}
      {publishOpen && <div onClick={() => !publishing && setPublishOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '48px 16px' }}>
        <div role="dialog" aria-modal="true" aria-label="Publish settings" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg)', borderRadius: 18, width: '100%', maxWidth: 560, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>{isPublished ? 'Piece settings' : 'Ready to publish?'}</div>

          <label style={fl}>Format</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => { setFormat(f.id); setDirty(true) }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: format === f.id ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: format === f.id ? 'rgba(194,122,90,0.06)' : 'var(--sf)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{f.desc}</div>
              </button>
            ))}
          </div>
          {overLimit && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginBottom: 8 }}>This piece is {wordCount} words, over the Reflection limit. Choose Essay, or trim it.</div>}

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 }}>
            <label style={fl}>Themes (optional)</label>
            {aiReady && <button type="button" onClick={suggestThemes} disabled={suggesting} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--tc)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: suggesting ? 0.5 : 1 }}>
              {suggesting ? 'Suggesting…' : 'Suggest themes'}
            </button>}
          </div>
          <input style={fi} placeholder="grief, identity, coming of age" value={tagsInput} onChange={edit(setTagsInput)} />
          <div style={{ ...meta, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{suggestNote || 'Comma-separated. Helps readers find your writing by theme.'}</div>

          {myClubs.length > 0 && <div style={{ marginTop: 20 }}>
            <label style={fl}>Share with a club (optional)</label>
            <select style={fi} value={clubId} onChange={edit(setClubId)}>
              <option value="">No club. Just my profile</option>
              {myClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>}

          <label style={{ ...fl, marginTop: 20 }}>Cover image (optional)</label>
          {coverUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src={coverUrl} alt="Cover" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} />
              <label style={{ ...meta, fontWeight: 600, color: 'var(--tc)', cursor: 'pointer' }}>
                Change<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { uploadCover(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <button type="button" onClick={() => { setCoverUrl(''); setDirty(true) }} style={{ ...meta, fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Remove</button>
            </div>
          ) : (
            <label style={{ display: 'block', textAlign: 'center', padding: '18px', border: '1.5px dashed var(--bd2)', borderRadius: 12, ...meta, cursor: coverBusy ? 'default' : 'pointer' }}>
              {coverBusy ? 'Uploading\u2026' : 'Add a cover image (JPG, PNG, WebP or GIF, up to 5 MB)'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={coverBusy} style={{ display: 'none' }} onChange={e => { uploadCover(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
          {coverError && <div role="alert" style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 6 }}>{coverError}</div>}

          <label style={{ ...fl, marginTop: 24 }}>Preview</label>
          {coverUrl && <img src={coverUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '14px 14px 0 0', border: '1px solid var(--bd)', borderBottom: 'none' }} />}
          <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: coverUrl ? '0 0 14px 14px' : 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 6 }}>
              {FORMATS.find(f => f.id === format)?.label}{clubId ? ` · ${myClubs.find(c => c.id === clubId)?.name || ''}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.25 }}>{title.trim() || 'Untitled'}</div>
            {subtitle.trim() && <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--txD)', marginTop: 4 }}>{subtitle.trim()}</div>}
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.6, marginTop: 8 }}>{excerpt}</div>
            <div style={{ ...meta, fontSize: 11, marginTop: 10 }}>{currentUser.first_name} {currentUser.last_name} {'·'} {minutes} min read</div>
          </div>

          {saveError && <div role="alert" style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 14, lineHeight: 1.6 }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button style={btnO} disabled={publishing} onClick={() => setPublishOpen(false)}>{isPublished ? 'Close' : 'Keep writing'}</button>
            <button style={{ ...btn, background: 'var(--tc)', opacity: canPublish && !publishing ? 1 : 0.5 }} disabled={!canPublish || publishing} onClick={publishNow}>
              {publishing ? 'Publishing…' : isPublished ? 'Save and update' : 'Publish now'}
            </button>
          </div>
        </div>
      </div>}
    </div>
  )
}
