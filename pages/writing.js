import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

function initialsFor(m) {
  if (m?.initials) return m.initials
  const f = (m?.first_name || '')[0] || ''
  const l = (m?.last_name || '')[0] || ''
  return (f + l).toUpperCase() || '?'
}
function Avatar({ member, size = 32 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{initialsFor(member)}</div>
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

const FORMAT_LABEL = { essay: 'Essay', reflection: 'Reflection', note: 'Note' }

export default function WritingFeed() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [writings, setWritings] = useState([])
  const [followedIds, setFollowedIds] = useState(null) // null = not loaded / logged out
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).single()
      if (m) setCurrentUser(m)
      const { data: f } = await supabase.from('writing_follows').select('writer_member_id').eq('follower_member_id', session.user.id)
      if (f) setFollowedIds(new Set(f.map(x => x.writer_member_id)))
    })
  }, [])

  async function load() {
    const { data } = await supabase
      .from('writings')
      .select('*, author:members(id, first_name, last_name, initials, color)')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(100)
    if (data) setWritings(data)
    setLoading(false)
  }

  const following = tab === 'following'
  const visible = following && followedIds
    ? writings.filter(w => followedIds.has(w.member_id))
    : writings

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Writing — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="nav-btn" onClick={() => router.push('/bridge')}>Bridge</button>
            <button className="nav-btn active">Writing</button>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="user-nav" onClick={() => router.push(`/profile/${currentUser.id}`)}>
                  <span className="user-nav-name">{currentUser.first_name}</span>
                </div>
              </div>
            ) : (
              <button className="join-btn" onClick={() => router.push('/signup')}>Join</button>
            )}
          </div>
        </nav>

        <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 80 }}>
          <section style={{ padding: '48px 0 28px' }}>
            <h1 className="hero-h1" style={{ fontSize: 40, marginBottom: 12 }}>Writing</h1>
            <p style={{ fontFamily: 'var(--ui)', fontSize: 15, lineHeight: 1.7, color: 'var(--txD)', maxWidth: 480 }}>
              Essays, reflections, and notes from readers across unscripted.
            </p>
          </section>

          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--bd)', marginBottom: 24 }}>
            {[['all', 'Latest'], ['following', 'Following']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: tab === k ? 'var(--ink)' : 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px 12px 0', position: 'relative' }}>
                {l}{tab === k && <div style={{ position: 'absolute', bottom: -1, left: 0, right: 20, height: 2, background: 'var(--tc)', borderRadius: 2 }} />}
              </button>
            ))}
          </div>

          {loading && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Loading…</div>}

          {!loading && following && !currentUser && (
            <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 16, padding: '40px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontStyle: 'italic', color: 'var(--txD)', marginBottom: 16 }}>Sign in to follow writers.</div>
              <button className="join-btn" onClick={() => router.push('/login')}>Log in</button>
            </div>
          )}

          {!loading && following && currentUser && visible.length === 0 && (
            <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 16, padding: '40px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontStyle: 'italic', color: 'var(--txD)', marginBottom: 8 }}>You're not following any writers yet.</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginBottom: 20 }}>Browse Latest and follow writers whose work speaks to you.</div>
              <button className="join-btn" onClick={() => setTab('all')}>Browse Latest</button>
            </div>
          )}

          {!loading && !(following && !currentUser) && visible.map(w => {
            const preview = (w.content || '').length > 200 ? w.content.slice(0, 200) + '…' : w.content
            return (
              <div key={w.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '22px 26px', marginBottom: 14, cursor: 'pointer' }} onClick={() => router.push(`/writing/${w.id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div onClick={e => { e.stopPropagation(); if (w.author) router.push(`/profile/${w.author.id}`) }} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <Avatar member={w.author} size={30} />
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{w.author ? `${w.author.first_name} ${w.author.last_name}` : 'Unknown'}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>{FORMAT_LABEL[w.format] || 'Note'}</span>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 'auto' }}>{timeAgo(w.published_at || w.created_at)}</span>
                </div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8, lineHeight: 1.2 }}>{w.title}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.65 }}>{preview}</div>
              </div>
            )
          })}

          {!loading && tab === 'all' && visible.length === 0 && (
            <div style={{ background: 'var(--sf)', border: '1px dashed var(--bd2)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>No writing published yet.</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 24 }}>Be the first to share an essay, reflection, or note.</div>
              {currentUser && <button className="join-btn" onClick={() => router.push('/write')}>Start writing</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
