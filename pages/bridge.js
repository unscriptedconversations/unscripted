import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

function timeAgo(date) {
  if (!date) return ''
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

export default function BridgeIndex() {
  const router = useRouter()
  const [threads, setThreads] = useState([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: ts } = await supabase.from('bridge_threads').select('*')
    const list = ts || []

    // One pass over posts → per-thread participant / club / post counts.
    const { data: ps } = await supabase.from('bridge_posts').select('thread_id, member_id, club_id')
    const stats = {}
    for (const p of (ps || [])) {
      const s = stats[p.thread_id] || (stats[p.thread_id] = { members: new Set(), clubs: new Set(), posts: 0 })
      if (p.member_id) s.members.add(p.member_id)
      if (p.club_id) s.clubs.add(p.club_id)
      s.posts++
    }

    const enriched = list.map(t => {
      const s = stats[t.id] || { members: new Set(), clubs: new Set(), posts: 0 }
      return { ...t, readers: s.members.size, clubs: s.clubs.size, postCount: s.posts }
    }).sort((a, b) => new Date(b.last_post_at || b.created_at) - new Date(a.last_post_at || a.created_at))

    setThreads(enriched)
    setLoading(false)
  }

  const shown = threads.filter(t => tab === 'all' || t.kind === tab)

  function openThread(t) {
    if (t.kind === 'book') router.push(`/bridge/book/${encodeURIComponent(t.title)}${t.subtitle ? `?author=${encodeURIComponent(t.subtitle)}` : ''}`)
    else router.push(`/bridge/theme/${encodeURIComponent(t.title || t.anchor)}`)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Bridge — unscripted</title>
      <div className="shell">
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="nav-btn" onClick={() => router.push('/writing')}>Writing</button>
          </div>
        </nav>

        <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>
          <div style={{ padding: '32px 0 8px' }}>
            <h1 className="hero-h1" style={{ fontSize: 40, marginBottom: 10 }}>Bridge</h1>
            <p style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)', lineHeight: 1.6 }}>Conversations that cross clubs — anchored to a book, or to a theme.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
            {[['all', 'All'], ['book', 'Books'], ['theme', 'Themes']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: tab === k ? 'var(--tc)' : 'var(--txD)', background: tab === k ? 'var(--tcD)' : 'transparent', border: '1px solid ' + (tab === k ? 'var(--tc)' : 'var(--bd)'), borderRadius: 100, padding: '7px 16px', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '24px 0' }}>Loading…</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 34, marginBottom: 14 }}>↗</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontStyle: 'italic', color: 'var(--txD)' }}>No conversations yet.</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 8, lineHeight: 1.6 }}>Bridges open from any book or theme page — start one and it shows up here.</div>
            </div>
          ) : shown.map(t => (
            <div key={t.id} onClick={() => openThread(t)} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, marginBottom: 12, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: t.kind === 'book' ? 'var(--tc)' : 'var(--sg)' }}>{t.kind === 'book' ? '📖 Book' : '◆ Theme'}</span>
                  <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 'auto' }}>{timeAgo(t.last_post_at || t.created_at)}</span>
                </div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 19, fontWeight: 600, fontStyle: t.kind === 'book' ? 'italic' : 'normal', color: 'var(--ink)', lineHeight: 1.2 }}>{t.title}</div>
                {t.kind === 'book' && t.subtitle && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginTop: 2 }}>{t.subtitle}</div>}
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--txD)', marginTop: 10 }}>
                  {[t.clubs > 0 && `${t.clubs} club${t.clubs !== 1 ? 's' : ''}`, `${t.readers} reader${t.readers !== 1 ? 's' : ''}`, `${t.postCount} post${t.postCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, marginTop: 2 }}>→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
