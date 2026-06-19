import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

function MemberAvatar({ member, size = 36 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{member?.initials || '?'}</div>
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

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

  useEffect(() => {
    try { const sv = window.localStorage?.getItem?.('unscripted_user'); if (sv) setCurrentUser(JSON.parse(sv)) } catch (e) {}
  }, [])

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    const { data: w } = await supabase.from('writings').select('*').eq('id', id).single()
    if (!w || !w.is_published) { setNotFound(true); return }
    setWriting(w)
    const { data: m } = await supabase.from('members').select('*').eq('id', w.member_id).single()
    if (m) setAuthor(m)
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
    if (!currentUser) { router.push('/signup'); return }
    if (following) {
      await supabase.from('writing_follows').delete().eq('follower_member_id', currentUser.id).eq('writer_member_id', author.id)
    } else {
      await supabase.from('writing_follows').insert({ follower_member_id: currentUser.id, writer_member_id: author.id })
    }
    setFollowing(!following)
  }

  if (notFound) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>This piece isn't available.</div></div>
  if (!writing) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  const isOwner = currentUser && currentUser.id === writing.member_id

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{writing.title} — unscripted</title>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
          {isOwner && <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }} onClick={() => router.push(`/write?id=${writing.id}`)}>Edit</button>}
        </div>

        <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>{FORMAT_LABEL[writing.format]}</span>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 38, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.15, margin: '10px 0 24px' }}>{writing.title}</div>

        {author && <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 24, marginBottom: 32, borderBottom: '1px solid var(--bd)' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}`)}><MemberAvatar member={author} size={44} /></div>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => router.push(`/profile/${author.id}`)}>{author.first_name} {author.last_name}</span>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{timeAgo(writing.published_at)}{club ? ` · written for ${club.name}` : ''}</div>
          </div>
          {!isOwner && <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: following ? 'var(--sg)' : 'var(--ink)', background: following ? 'rgba(94,122,98,0.1)' : 'none', border: following ? 'none' : '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
        </div>}

        <div style={{ fontFamily: 'var(--hd)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{writing.content}</div>
      </div>
    </div>
  )
}
