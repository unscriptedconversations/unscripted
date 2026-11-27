import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import TopNav from '../../components/TopNav'
import { createNotification } from '../../lib/notify'

function MemberAvatar({ member, size = 36 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{member?.initials || '?'}</div>
}

function dateLabel(d) {
  if (!d) return ''
  const dt = new Date(d)
  const sameYear = dt.getFullYear() === new Date().getFullYear()
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}
function readMinutes(t) { const n = String(t || '').trim() ? String(t).trim().split(/\s+/).length : 0; return Math.max(1, Math.round(n / 230)) }
// Blank lines separate paragraphs; single line breaks are kept inside them
function paragraphs(t) { return String(t || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) }

const FORMAT_LABEL = { essay: 'Essay', reflection: 'Reflection', note: 'Note' }

export default function WritingPage() {
  const router = useRouter()
  const { id } = router.query
  const [writing, setWriting] = useState(null)
  const [author, setAuthor] = useState(null)
  const [club, setClub] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [following, setFollowing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [more, setMore] = useState([])      // other published pieces by this writer
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: member } = await supabase.from('members').select('*').eq('id', session.user.id).single()
      if (member) setCurrentUser(member)
    })
  }, [])

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    const { data: w } = await supabase.from('writings').select('*').eq('id', id).single()
    if (!w || !w.is_published) { setNotFound(true); return }
    setWriting(w)
    const { data: m } = await supabase.from('members').select('*').eq('id', w.member_id).single()
    if (m) setAuthor(m)
    const { data: others } = await supabase.from('writings').select('id, title, subtitle, format, content, published_at')
      .eq('member_id', w.member_id).eq('is_published', true).neq('id', w.id).order('published_at', { ascending: false }).limit(3)
    setMore(others || [])
    if (w.club_id) {
      const { data: c } = await supabase.from('clubs').select('id, name').eq('id', w.club_id).single()
      if (c) setClub(c)
    }
  }

  useEffect(() => {
    if (currentUser && author) checkFollowing()
  }, [currentUser, author])

  async function checkFollowing() {
    const { data } = await supabase.from('writing_follows').select('id').eq('follower_member_id', currentUser.id).eq('writer_member_id', author.id).maybeSingle()
    setFollowing(!!data)
  }

  async function toggleFollow() {
    if (!currentUser) { router.push('/login?redirect=/writing/' + id); return }
    if (following) {
      await supabase.from('writing_follows').delete().eq('follower_member_id', currentUser.id).eq('writer_member_id', author.id)
    } else {
      await supabase.from('writing_follows').insert({ follower_member_id: currentUser.id, writer_member_id: author.id })
      createNotification({ recipientId: author.id, actorId: currentUser.id, type: 'follow', link: `/profile/${currentUser.id}` })
    }
    setFollowing(!following)
  }

  async function share() {
    const url = window.location.href.split('#')[0]
    try {
      if (navigator.share) { await navigator.share({ title: writing.title, url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch (e) { /* closed the share sheet */ }
  }

  if (notFound) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>This piece isn't available.</div></div>
  if (!writing) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  const isOwner = currentUser && currentUser.id === writing.member_id

  const kicker = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }
  const smallBtn = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }
  const followBtn = { ...smallBtn, color: following ? 'var(--sg)' : 'var(--ink)', background: following ? 'rgba(94,122,98,0.1)' : 'none', border: following ? '1.5px solid transparent' : '1.5px solid var(--bd2)' }
  const mins = readMinutes(writing.content)

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{writing.title} — unscripted</title>
      <TopNav />
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '0 28px 96px' }}>
        <div style={{ padding: '20px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button style={{ ...smallBtn, border: 'none', padding: 0, color: 'var(--txD)' }} onClick={() => router.push('/writing')}>{'\u2190'} All writing</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={smallBtn} onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            {isOwner && <button style={smallBtn} onClick={() => router.push(`/write?id=${writing.id}`)}>Edit</button>}
          </div>
        </div>

        <div style={kicker}>
          {FORMAT_LABEL[writing.format] || 'Writing'}
          {club && <>{' \u00B7 '}<span style={{ cursor: 'pointer' }} onClick={() => router.push(`/club/${club.id}`)}>{club.name}</span></>}
        </div>
        <h1 style={{ fontFamily: 'var(--hd)', fontSize: 'clamp(34px, 6vw, 46px)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.12, margin: '12px 0 0' }}>{writing.title}</h1>
        {writing.subtitle && <div style={{ fontFamily: 'var(--hd)', fontSize: 23, fontStyle: 'italic', color: 'var(--txD)', lineHeight: 1.35, marginTop: 12 }}>{writing.subtitle}</div>}

        {author && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', margin: '28px 0 36px', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}`)}><MemberAvatar member={author} size={44} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}`)}>{author.first_name} {author.last_name}</span>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{dateLabel(writing.published_at)} {'\u00B7'} {mins} min read</div>
          </div>
          {!isOwner && <button style={followBtn} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
        </div>}

        <div style={{ fontFamily: 'var(--hd)', fontSize: 21, color: 'var(--ink)', lineHeight: 1.8 }}>
          {paragraphs(writing.content).map((p, i) => <p key={i} style={{ margin: '0 0 1.15em', whiteSpace: 'pre-wrap' }}>{p}</p>)}
        </div>

        {(writing.tags || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 28 }}>
          {writing.tags.map(t => <span key={t} onClick={() => router.push(`/search?q=${encodeURIComponent(t)}`)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '5px 12px', cursor: 'pointer' }}>{t}</span>)}
        </div>}

        {/* End of piece: the writer, then more of their work */}
        {author && <div style={{ marginTop: 56, padding: '28px 0', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}`)}><MemberAvatar member={author} size={52} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)' }}>Written by</div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}?tab=writing`)}>{author.first_name} {author.last_name}</div>
          </div>
          {!isOwner && <button style={followBtn} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
          <button style={smallBtn} onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
        </div>}

        {more.length > 0 && <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 12 }}>More from {author?.first_name || 'this writer'}</div>
          {more.map(w => (
            <div key={w.id} onClick={() => router.push(`/writing/${w.id}`)} style={{ padding: '16px 0', borderTop: '1px solid var(--bd)', cursor: 'pointer' }}>
              <div style={{ ...kicker, fontSize: 9 }}>{FORMAT_LABEL[w.format] || 'Writing'}</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25, marginTop: 4 }}>{w.title}</div>
              {w.subtitle && <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--txD)', marginTop: 2 }}>{w.subtitle}</div>}
              <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 6 }}>{dateLabel(w.published_at)} {'\u00B7'} {readMinutes(w.content)} min read</div>
            </div>
          ))}
        </div>}
      </article>
    </div>
  )
}
