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
  const [myClubs, setMyClubs] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [format, setFormat] = useState('reflection')
  const [clubId, setClubId] = useState('')
  const [writingId, setWritingId] = useState(null)
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const sv = window.localStorage?.getItem?.('unscripted_user')
      if (sv) {
        const u = JSON.parse(sv)
        setCurrentUser(u)
        loadMyClubs(u.id)
      }
    } catch (e) {}
  }, [])

  useEffect(() => { if (id) loadWriting(id) }, [id])

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
      setIsPublished(data.is_published)
    }
  }

  async function save(publish) {
    if (!currentUser || !title.trim() || !content.trim()) return
    setSaving(true)
    const payload = {
      member_id: currentUser.id,
      title: title.trim(),
      content: content.trim(),
      format,
      club_id: clubId || null,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    if (writingId) {
      await supabase.from('writings').update(payload).eq('id', writingId)
    } else {
      const { data } = await supabase.from('writings').insert(payload).select().single()
      if (data) setWritingId(data.id)
    }
    setIsPublished(publish)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (publish && writingId) router.push(`/writing/${writingId}`)
  }

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer' }

  if (!currentUser) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <title>Write — unscripted</title>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>You need an account to write.</div>
        <button style={btn} onClick={() => router.push('/signup')}>Join unscripted</button>
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
