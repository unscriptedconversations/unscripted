import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

function initialsFor(m) {
  if (m?.initials) return m.initials
  const f = (m?.first_name || '')[0] || ''
  const l = (m?.last_name || '')[0] || ''
  return (f + l).toUpperCase() || '?'
}
function Avatar({ member, size = 34 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{initialsFor(member)}</div>
}
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

export default function BridgeThemeThread() {
  const router = useRouter()
  const { tag } = router.query
  const [currentUser, setCurrentUser] = useState(null)
  const [thread, setThread] = useState(null)
  const [posts, setPosts] = useState([])
  const [relBooks, setRelBooks] = useState([])
  const [relWritings, setRelWritings] = useState([])
  const [relClubs, setRelClubs] = useState([])
  const [bookCount, setBookCount] = useState(0)
  const [readerCount, setReaderCount] = useState(0)
  const [newPost, setNewPost] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  const theme = typeof tag === 'string' ? decodeURIComponent(tag) : ''
  const anchor = theme.toLowerCase().trim()
  const label = theme.charAt(0).toUpperCase() + theme.slice(1)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).single()
      if (m) setCurrentUser(m)
    })
  }, [])

  useEffect(() => { if (router.isReady && anchor) load() }, [router.isReady, anchor])

  async function load() {
    const { data: t } = await supabase.from('bridge_threads').select('*').eq('kind', 'theme').eq('anchor', anchor).maybeSingle()
    if (t) { setThread(t); await loadPosts(t.id) }
    // Things carrying this theme (tag containment)
    const tagFilter = `{${theme}}`
    const [bk, wr, cl, bc] = await Promise.all([
      supabase.from('books').select('id, title, author').filter('tags', 'cs', tagFilter).limit(8),
      supabase.from('writings').select('id, title, format').eq('is_published', true).filter('tags', 'cs', tagFilter).limit(8),
      supabase.from('clubs').select('id, name, description, privacy').filter('tags', 'cs', tagFilter).limit(12),
      supabase.from('books').select('id', { count: 'exact', head: true }).filter('tags', 'cs', tagFilter),
    ])
    setRelBooks(bk.data || [])
    setRelWritings(wr.data || [])
    setRelClubs(cl.data || [])
    setBookCount(bc.count || 0)

    const clubIds = (cl.data || []).map(c => c.id)
    if (clubIds.length) {
      const { count } = await supabase.from('club_members').select('id', { count: 'exact', head: true }).in('club_id', clubIds)
      setReaderCount(count || 0)
    }
    setLoading(false)
  }

  async function loadPosts(tid) {
    const { data } = await supabase
      .from('bridge_posts')
      .select('*, author:members(id, first_name, last_name, initials, color), club:clubs(name)')
      .eq('thread_id', tid)
      .order('created_at', { ascending: true })
    setPosts(data || [])
  }

  async function ensureThread() {
    if (thread) return thread
    const { data: existing } = await supabase.from('bridge_threads').select('*').eq('kind', 'theme').eq('anchor', anchor).maybeSingle()
    if (existing) { setThread(existing); return existing }
    const { data: created, error } = await supabase.from('bridge_threads').insert({
      kind: 'theme', anchor, title: label, subtitle: null, created_by: currentUser.id, auto: false,
    }).select().single()
    if (error) return null
    setThread(created)
    return created
  }

  async function submitPost() {
    if (!currentUser || !newPost.trim()) return
    setPosting(true)
    const t = await ensureThread()
    if (!t) { setPosting(false); return }
    await supabase.from('bridge_posts').insert({ thread_id: t.id, member_id: currentUser.id, content: newPost.trim() })
    await supabase.from('bridge_threads').update({ last_post_at: new Date().toISOString() }).eq('id', t.id)
    setNewPost('')
    setPosting(false)
    loadPosts(t.id)
  }

  const chip = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 100, padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{label} — Bridge — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="nav-btn" onClick={() => router.push('/writing')}>Writing</button>
          </div>
        </nav>

        <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 100 }}>
          <button className="profile-back" onClick={() => router.back()}>← Back</button>

          {/* Header */}
          <div style={{ background: 'var(--ink)', borderRadius: 18, padding: '32px 30px', margin: '20px 0 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--sg), var(--tc))' }} />
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sg)', marginBottom: 12 }}>◆ Theme</div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 34, fontWeight: 600, fontStyle: 'italic', color: '#F2EBE0', lineHeight: 1.1 }}>{label}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'rgba(242,235,224,0.6)', marginTop: 14, lineHeight: 1.6 }}>
              A conversation about {label.toLowerCase()} — spanning every book and every club that touches it.
            </div>
          </div>

          {/* Discovery: stats + clubs in this genre */}
          {relClubs.length > 0 && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--tc)', marginBottom: 18 }}>
            {[`${relClubs.length} club${relClubs.length !== 1 ? 's' : ''}`, `${bookCount} book${bookCount !== 1 ? 's' : ''}`, `${readerCount} reader${readerCount !== 1 ? 's' : ''}`].join(' · ')}
          </div>}

          {relClubs.length > 0 && <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 12 }}>Clubs in this genre</div>
            {relClubs.map(c => (
              <div key={c.id} onClick={() => router.push(`/club/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{c.description}</div>
                </div>
                <span className="tag" style={{ background: c.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: c.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{c.privacy}</span>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 10, color: 'var(--tc)', fontWeight: 600 }}>→</span>
              </div>
            ))}
          </div>}

          {/* Related works carrying this theme */}
          {(relBooks.length > 0 || relWritings.length > 0) && <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 12 }}>Explore this theme</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {relBooks.map(b => <span key={b.id} style={chip} onClick={() => router.push(`/book/${b.id}`)}>📖 {b.title}</span>)}
              {relWritings.map(w => <span key={w.id} style={chip} onClick={() => router.push(`/writing/${w.id}`)}>✍️ {w.title}</span>)}
            </div>
          </div>}

          {/* Composer */}
          {currentUser ? (
            <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '18px 20px', marginBottom: 28 }}>
              <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder={`Share a thought on ${label.toLowerCase()}…`} rows={3}
                style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={submitPost} disabled={posting || !newPost.trim()} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--sg)', border: 'none', borderRadius: 8, padding: '11px 22px', cursor: 'pointer', opacity: (posting || !newPost.trim()) ? 0.4 : 1 }}>{posting ? 'Posting…' : 'Post'}</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 14, padding: '24px', textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 14 }}>Log in to join the conversation.</div>
              <button className="join-btn" onClick={() => router.push('/login')}>Log in</button>
            </div>
          )}

          {/* Posts */}
          {loading ? (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Loading…</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>💬</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontStyle: 'italic', color: 'var(--txD)' }}>No one's spoken yet.</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 8 }}>Start the conversation on {label.toLowerCase()}.</div>
            </div>
          ) : posts.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => p.author && router.push(`/profile/${p.author.id}`)}><Avatar member={p.author} size={38} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => p.author && router.push(`/profile/${p.author.id}`)}>{p.author ? `${p.author.first_name} ${p.author.last_name}` : 'Unknown'}</span>
                  {p.club?.name && <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 600, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '2px 8px' }}>{p.club.name}</span>}
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 'auto' }}>{timeAgo(p.created_at)}</span>
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
