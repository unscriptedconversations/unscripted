import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

const FORMATS = [
  { id: 'note', label: 'Note', desc: 'A quick thought' },
  { id: 'reflection', label: 'Reflection', desc: 'A few paragraphs' },
  { id: 'essay', label: 'Essay', desc: 'Long-form' },
]

export default function Write() {
  const router = useRouter()
  const { id } = router.query
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [myClubs, setMyClubs] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [format, setFormat] = useState('reflection')
  const [clubId, setClubId] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [writingId, setWritingId] = useState(null)
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: u } = await supabase.from('members').select('*').eq('id', session.user.id).single()
        if (u) { setCurrentUser(u); loadMyClubs(u.id) }
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => { if (id) loadWriting(id) }, [id])

  // Prefill the book title as a starting tag when arriving from a book page
  // (/write?about=Title). New pieces only; never clobber an existing draft.
  useEffect(() => {
    if (!router.isReady || id) return
    const about = Array.isArray(router.query.about) ? router.query.about[0] : router.query.about
    if (about) setTagsInput(prev => prev || String(about))
  }, [router.isReady])

  async function loadMyClubs(memberId) {
    const { data } = await supabase.from('club_members').select('club:clubs(id, name)').eq('member_id', memberId)
    if (data) setMyClubs(data.map(d => d.club).filter(Boolean))
  }

  async function loadWriting(wid) {
    const { data } = await supabase.from('writings').select('*').eq('id', wid).single()
    if (data) {
      setWritingId(data.id)
      setTitle(data.title)
      setContent(data.content)
      setFormat(data.format)
      setClubId(data.club_id || '')
      setTagsInput((data.tags || []).join(', '))
      setIsPublished(data.is_published)
    }
  }

  // AI theme suggestions (dormant until ANTHROPIC_API_KEY is set — returns
  // nothing gracefully otherwise). Suggestions merge into the editable tags
  // field for the author to review; never auto-applied.
  async function suggestThemes() {
    if (suggesting) return
    if (content.trim().length < 200) { setSuggestNote('Write a little more first.'); return }
    setSuggesting(true); setSuggestNote('')
    try {
      const r = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      const d = await r.json()
      const themes = Array.isArray(d.themes) ? d.themes : []
      if (!themes.length) { setSuggestNote('No suggestions right now.'); setSuggesting(false); return }
      const existing = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const seen = new Set(existing.map(t => t.toLowerCase()))
      const merged = [...existing]
      for (const th of themes) { const k = th.toLowerCase(); if (!seen.has(k)) { seen.add(k); merged.push(th) } }
      setTagsInput(merged.join(', '))
      setSuggestNote(`Added ${themes.length} suggested theme${themes.length !== 1 ? 's' : ''} — edit as you like.`)
    } catch {
      setSuggestNote('Couldn’t suggest themes just now.')
    }
    setSuggesting(false)
  }

  async function save(publish) {
    if (!currentUser || !title.trim() || !content.trim()) return
    setSaving(true)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      member_id: currentUser.id,
      title: title.trim(),
      content: content.trim(),
      format,
      club_id: clubId || null,
      tags,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    let savedId = writingId
    if (writingId) {
      await supabase.from('writings').update(payload).eq('id', writingId)
    } else {
      const { data } = await supabase.from('writings').insert(payload).select().single()
      if (data) { savedId = data.id; setWritingId(data.id) }
    }
    setIsPublished(publish)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (publish && savedId) router.push(`/writing/${savedId}`)
  }

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer' }

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading…</div></div>

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

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{writingId ? 'Edit' : 'Write'} — unscripted</title>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
          {isPublished && <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '6px 14px' }}>Published</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)} style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: format === f.id ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: format === f.id ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{f.desc}</div>
            </button>
          ))}
        </div>

        <input
          style={{ ...fi, fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, fontStyle: 'italic', border: 'none', background: 'none', padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--bd)', borderRadius: 0 }}
          placeholder="Give it a title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <textarea
          style={{ ...fi, minHeight: 360, resize: 'vertical', lineHeight: 1.7, fontSize: 16 }}
          placeholder="Start writing..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <label style={fl}>Themes (optional)</label>
          <button type="button" onClick={suggestThemes} disabled={suggesting} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--tc)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: suggesting ? 0.5 : 1 }}>
            {suggesting ? 'Suggesting…' : 'Suggest themes'}
          </button>
        </div>
        <input style={fi} placeholder="grief, identity, coming of age" value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
        <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: -16, marginBottom: 28, lineHeight: 1.5 }}>{suggestNote || 'Comma-separated. Helps readers find your writing by theme.'}</div>

        {myClubs.length > 0 && <div style={{ marginBottom: 32 }}>
          <label style={fl}>Tag a club (optional)</label>
          <select style={{ ...fi, marginBottom: 0 }} value={clubId} onChange={e => setClubId(e.target.value)}>
            <option value="">No club — independent piece</option>
            {myClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={btnO} disabled={saving} onClick={() => save(false)}>Save draft</button>
          <button style={{ ...btn, flex: 1, opacity: title.trim() && content.trim() ? 1 : 0.4 }} disabled={saving || !title.trim() || !content.trim()} onClick={() => save(true)}>Publish</button>
        </div>
        {saved && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--sg)', marginTop: 12, textAlign: 'center' }}>Saved</div>}
      </div>
    </div>
  )
}
