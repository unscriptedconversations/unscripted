import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

function MemberAvatar({ member, size = 32 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{member?.initials || '?'}</div>
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

const CLUB_BADGE_COLORS = ['#EEEDFE', '#E1F5EE', '#FAECE7', '#FBEAF0', '#E6F1FB', '#EAF3DE', '#FAEEDA']
const CLUB_BADGE_TEXT = ['#3C3489', '#085041', '#712B13', '#72243E', '#0C447C', '#27500A', '#633806']
function clubBadgeStyle(clubId) {
  const i = clubId ? clubId.charCodeAt(0) % CLUB_BADGE_COLORS.length : 0
  return { background: CLUB_BADGE_COLORS[i], color: CLUB_BADGE_TEXT[i] }
}

export default function BridgePage() {
  const router = useRouter()
  const { type, ref } = router.query
  const [thread, setThread] = useState(null)
  const [posts, setPosts] = useState([])
  const [clubsInThread, setClubsInThread] = useState([])
  const [otherBridges, setOtherBridges] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [myClubs, setMyClubs] = useState([])
  const [postClubId, setPostClubId] = useState('')
  const [newPost, setNewPost] = useState('')
  const [notEnough, setNotEnough] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { const sv = window.localStorage?.getItem?.('unscripted_user'); if (sv) setCurrentUser(JSON.parse(sv)) } catch (e) {}
  }, [])

  useEffect(() => { if (type && ref) load() }, [type, ref])
  useEffect(() => { if (currentUser) loadMyClubs() }, [currentUser])

  async function loadMyClubs() {
    const { data } = await supabase.from('club_members').select('club:clubs(id, name)').eq('member_id', currentUser.id)
    if (data) {
      const cs = data.map(d => d.club).filter(Boolean)
      setMyClubs(cs)
      if (cs[0]) setPostClubId(cs[0].id)
    }
  }

  async function load() {
    setLoading(true)
    let t = null

    const { data: existing } = await supabase.from('global_threads').select('*').eq('type', type).eq('ref', ref).maybeSingle()

    if (type === 'book') {
      const { data: books } = await supabase.from('books').select('title, author, club_id, club:clubs(id, name)').eq('book_key', ref)
      const uniqueClubs = [...new Map((books || []).filter(b => b.club).map(b => [b.club.id, b.club])).values()]
      if (uniqueClubs.length >= 2) {
        const title = books?.[0]?.title || ref
        const author = books?.[0]?.author || ''
        const { data: upserted } = await supabase.from('global_threads').upsert(
          { type: 'book', ref, title, author, club_count: uniqueClubs.length },
          { onConflict: 'type,ref' }
        ).select().single()
        t = upserted || existing
        setClubsInThread(uniqueClubs)
      } else if (existing) {
        t = existing
        setClubsInThread(uniqueClubs)
      } else {
        setNotEnough(true)
        setLoading(false)
        return
      }
    } else {
      const { data: themedPosts } = await supabase.from('posts').select('club_id').ilike('themes', `%${ref}%`)
      const distinctClubIds = [...new Set((themedPosts || []).map(p => p.club_id).filter(Boolean))]
      if (distinctClubIds.length >= 2 || existing) {
        const title = ref.charAt(0).toUpperCase() + ref.slice(1)
        const { data: upserted } = await supabase.from('global_threads').upsert(
          { type: 'theme', ref, title, club_count: distinctClubIds.length || existing?.club_count || 0 },
          { onConflict: 'type,ref' }
        ).select().single()
        t = upserted || existing
      } else {
        setNotEnough(true)
        setLoading(false)
        return
      }
    }

    setThread(t)

    const { data: gp } = await supabase.from('global_posts').select('*, member:members(*), club:clubs(id, name)').eq('thread_id', t.id).order('created_at', { ascending: false })
    if (gp) setPosts(gp)

    const { data: ob } = await supabase.from('global_threads').select('*').neq('id', t.id).order('created_at', { ascending: false }).limit(4)
    if (ob) setOtherBridges(ob)

    setLoading(false)
  }

  async function submitPost() {
    if (!newPost.trim() || !currentUser || !thread) return
    await supabase.from('global_posts').insert({
      thread_id: thread.id,
      member_id: currentUser.id,
      club_id: postClubId || null,
      content: newPost.trim(),
    })
    setNewPost('')
    load()
  }

  const fmtSub = type === 'book' ? `${thread?.author || ''}` : 'Theme bridge'
  const participantCount = new Set(posts.map(p => p.member_id)).size

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  if (notEnough) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontStyle: 'italic', color: 'var(--txD)' }}>Not enough activity here yet.</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 8 }}>Bridges open once 2+ clubs are reading or discussing this.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{thread?.title} — unscripted</title>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>{type === 'book' ? 'Book bridge' : 'Theme bridge'}</span>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, fontStyle: type === 'book' ? 'italic' : 'normal', color: 'var(--ink)', margin: '8px 0 4px' }}>{thread?.title}</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginBottom: 16 }}>{fmtSub}{fmtSub ? ' · ' : ''}{thread?.club_count || 0} club{thread?.club_count !== 1 ? 's' : ''} · {participantCount} reader{participantCount !== 1 ? 's' : ''} in this thread</div>

          {clubsInThread.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {clubsInThread.map(c => (
              <span key={c.id} className="tag" style={{ ...clubBadgeStyle(c.id), cursor: 'pointer' }} onClick={() => router.push(`/club/${c.id}`)}>{c.name}</span>
            ))}
          </div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
          <div>
            {currentUser ? (
              <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
                <textarea
                  style={{ width: '100%', border: 'none', resize: 'none', fontFamily: 'var(--ui)', fontSize: 14, background: 'none', color: 'var(--ink)', outline: 'none', marginBottom: 10 }}
                  rows={2}
                  placeholder="Add to the global thread, from your club..."
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {myClubs.length > 1 ? (
                    <select style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txM)', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '6px 10px' }} value={postClubId} onChange={e => setPostClubId(e.target.value)}>
                      {myClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : myClubs[0] ? (
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>Posting from {myClubs[0].name}</span>
                  ) : <span />}
                  <button style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', opacity: newPost.trim() ? 1 : 0.4 }} disabled={!newPost.trim()} onClick={submitPost}>Post</button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--sf2)', borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 16, cursor: 'pointer' }} onClick={() => router.push('/signup')}>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Join to post in this bridge...</span>
              </div>
            )}

            {posts.length > 0 ? posts.map(p => (
              <div key={p.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/profile/${p.member?.id}`)}><MemberAvatar member={p.member} size={32} /></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => router.push(`/profile/${p.member?.id}`)}>{p.member?.first_name}</span>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 8 }}>{timeAgo(p.created_at)}</span>
                  </div>
                  {p.club && <span className="tag" style={clubBadgeStyle(p.club.id)}>{p.club.name}</span>}
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{p.content}</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontStyle: 'italic', color: 'var(--txD)' }}>No posts yet.</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 4 }}>Be the first to bridge the conversation.</div>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 12 }}>Other bridges</div>
            {otherBridges.length > 0 ? otherBridges.map(b => (
              <div key={b.id} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => router.push(`/bridge/${b.type}/${encodeURIComponent(b.ref)}`)}>
                <div style={{ fontFamily: b.type === 'book' ? 'var(--hd)' : 'var(--ui)', fontStyle: b.type === 'book' ? 'italic' : 'normal', fontSize: 13, fontWeight: b.type === 'book' ? 600 : 700, color: 'var(--ink)' }}>{b.title}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.club_count} clubs</div>
              </div>
            )) : <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>None yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
