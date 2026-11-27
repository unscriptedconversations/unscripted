import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import TopNav from '../../components/TopNav'
import { createNotification } from '../../lib/notify'
import { renderRich, plainText } from '../../lib/formatText'

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

const FORMAT_LABEL = { essay: 'Essay', reflection: 'Reflection', note: 'Note' }

// Link previews (texts, social media): crawlers don't run the page's scripts,
// so the title / description come from the server. Only published pieces get
// details; anything else falls back to the site name. Never blocks the page.
export async function getServerSideProps({ params, req }) {
  let og = null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const id = String(params?.id || '')
    if (url && key && /^[0-9a-f-]{36}$/i.test(id)) {
      const sb = createClient(url, key, { auth: { persistSession: false } })
      const { data: w } = await sb.from('writings').select('id, title, subtitle, content, cover_url, is_published, member_id').eq('id', id).maybeSingle()
      if (w && w.is_published) {
        const { data: m } = await sb.from('members').select('first_name, last_name').eq('id', w.member_id).maybeSingle()
        const plain = plainText(w.content).replace(/\s+/g, ' ').trim()
        const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || ''
        og = {
          title: w.title,
          description: (w.subtitle || plain).slice(0, 200) + ((w.subtitle || plain).length > 200 ? '\u2026' : ''),
          author: m ? `${m.first_name || ''} ${m.last_name || ''}`.trim() : '',
          url: host ? `https://${host}/writing/${w.id}` : '',
          image: w.cover_url && /^https:\/\//.test(w.cover_url) ? w.cover_url : '',
        }
      }
    }
  } catch (e) { og = null }
  return { props: { og } }
}

export default function WritingPage({ og }) {
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
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentError, setCommentError] = useState('')

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
    const { data: others } = await supabase.from('writings').select('id, title, subtitle, format, content, cover_url, published_at')
      .eq('member_id', w.member_id).eq('is_published', true).neq('id', w.id).order('published_at', { ascending: false }).limit(3)
    setMore(others || [])
    loadResponses(w.id)
    if (w.club_id) {
      const { data: c } = await supabase.from('clubs').select('id, name').eq('id', w.club_id).single()
      if (c) setClub(c)
    }
  }

  useEffect(() => {
    if (currentUser && author) checkFollowing()
  }, [currentUser, author])

  // Has the reader already hearted this piece?
  useEffect(() => {
    if (!currentUser || !writing) return
    supabase.from('writing_likes').select('id').eq('writing_id', writing.id).eq('member_id', currentUser.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [currentUser, writing])

  async function loadResponses(wid) {
    const [{ count }, { data: cs }] = await Promise.all([
      supabase.from('writing_likes').select('id', { count: 'exact', head: true }).eq('writing_id', wid),
      supabase.from('writing_comments').select('id, body, created_at, member_id, member:members(id, first_name, last_name, initials, color)').eq('writing_id', wid).order('created_at'),
    ])
    setLikeCount(count || 0)
    setComments(cs || [])
  }

  async function toggleLike() {
    if (!currentUser) { router.push('/login?redirect=/writing/' + id); return }
    const was = liked
    setLiked(!was); setLikeCount(n => Math.max(0, n + (was ? -1 : 1)))
    const { error } = was
      ? await supabase.from('writing_likes').delete().eq('writing_id', writing.id).eq('member_id', currentUser.id)
      : await supabase.from('writing_likes').insert({ writing_id: writing.id, member_id: currentUser.id })
    if (error && error.code !== '23505') { setLiked(was); setLikeCount(n => Math.max(0, n + (was ? 1 : -1))) }
  }

  async function postComment() {
    const body = newComment.trim()
    if (!currentUser) { router.push('/login?redirect=/writing/' + id); return }
    if (!body) return
    if (body.length > 2000) { setCommentError('Comments can be up to 2,000 characters.'); return }
    setPosting(true); setCommentError('')
    const { data, error } = await supabase.from('writing_comments').insert({ writing_id: writing.id, member_id: currentUser.id, body })
      .select('id, body, created_at, member_id').single()
    setPosting(false)
    if (error || !data) { setCommentError('Sorry, your comment couldn\u2019t be posted. Please try again.' + (error?.code ? ` (Error code: ${error.code})` : '')); return }
    setComments(cs => [...cs, { ...data, member: currentUser }])
    setNewComment('')
    if (currentUser.id !== writing.member_id) {
      createNotification({ recipientId: writing.member_id, actorId: currentUser.id, type: 'reply', link: `/writing/${writing.id}#comments`, preview: body.slice(0, 80) })
    }
  }

  async function deleteComment(cid) {
    if (!window.confirm('Delete this comment?')) return
    const { error } = await supabase.from('writing_comments').delete().eq('id', cid)
    if (error) { window.alert('Sorry, that comment couldn\u2019t be deleted.'); return }
    setComments(cs => cs.filter(c => c.id !== cid))
  }

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

  const ogHead = (
    <Head>
      <title>{og?.title ? `${og.title} — unscripted` : 'unscripted'}</title>
      <meta property="og:site_name" content="unscripted" />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={og?.title || 'unscripted'} />
      <meta property="og:description" content={og?.description || 'Writing from readers on unscripted.'} />
      {og?.url && <meta property="og:url" content={og.url} />}
      {og?.author && <meta name="author" content={og.author} />}
      <meta name="description" content={og?.description || 'Writing from readers on unscripted.'} />
      {og?.image && <meta property="og:image" content={og.image} />}
      {og?.image && <meta name="twitter:image" content={og.image} />}
      <meta name="twitter:card" content={og?.image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={og?.title || 'unscripted'} />
      <meta name="twitter:description" content={og?.description || 'Writing from readers on unscripted.'} />
    </Head>
  )

  if (notFound) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ogHead}<div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>This piece isn't available.</div></div>
  if (!writing) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ogHead}<div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  const isOwner = currentUser && currentUser.id === writing.member_id

  const kicker = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }
  const smallBtn = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }
  const followBtn = { ...smallBtn, color: following ? 'var(--sg)' : 'var(--ink)', background: following ? 'rgba(94,122,98,0.1)' : 'none', border: following ? '1.5px solid transparent' : '1.5px solid var(--bd2)' }
  const mins = readMinutes(plainText(writing.content))

  return (
    <div style={{ minHeight: '100vh' }}>
      {ogHead}
      <TopNav />
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '0 28px 96px' }}>
        <div style={{ padding: '20px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button style={{ ...smallBtn, border: 'none', padding: 0, color: 'var(--txD)' }} onClick={() => router.push('/writing')}>{'\u2190'} All writing</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={smallBtn} onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            {isOwner && <button style={smallBtn} onClick={() => router.push(`/write?id=${writing.id}`)}>Edit</button>}
          </div>
        </div>

        {writing.cover_url && <img src={writing.cover_url} alt="" style={{ display: 'block', width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 14, marginBottom: 32 }} />}
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
          {renderRich(writing.content)}
        </div>

        {(writing.tags || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 28 }}>
          {writing.tags.map(t => <span key={t} onClick={() => router.push(`/search?q=${encodeURIComponent(t)}`)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, color: 'var(--sg)', background: 'rgba(94,122,98,0.1)', borderRadius: 100, padding: '5px 12px', cursor: 'pointer' }}>{t}</span>)}
        </div>}

        {/* Responses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 36 }}>
          <button onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Remove heart' : 'Heart this piece'}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: liked ? 'var(--tc)' : 'var(--txD)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{liked ? '\u2665' : '\u2661'}</span>{likeCount}
          </button>
          <a href="#comments" style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--txD)', textDecoration: 'none' }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>{'\u{1F4AC}'}</span>{comments.length}
          </a>
        </div>

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

        <section id="comments" style={{ marginTop: 20, paddingTop: 28, borderTop: '1px solid var(--bd)', scrollMarginTop: 80 }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 16 }}>
            {comments.length ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}` : 'Comments'}
          </div>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => c.member && router.push(`/profile/${c.member.id}`)}><MemberAvatar member={c.member} size={32} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => c.member && router.push(`/profile/${c.member.id}`)}>{c.member ? `${c.member.first_name} ${c.member.last_name}` : 'A reader'}</span>
                  {c.member_id === writing.member_id && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tc)' }}>Writer</span>}
                  {' \u00B7 '}{dateLabel(c.created_at)}
                  {currentUser && (currentUser.id === c.member_id || isOwner) && <button onClick={() => deleteComment(c.id)} style={{ marginLeft: 10, fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Delete</button>}
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</div>
              </div>
            </div>
          ))}
          {currentUser ? (
            <div style={{ marginTop: 16 }}>
              <textarea value={newComment} maxLength={2000} rows={3} placeholder={isOwner ? 'Reply to your readers\u2026' : 'Share what this stirred in you\u2026'} aria-label="Write a comment"
                onChange={e => { setNewComment(e.target.value); setCommentError('') }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 12, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              {commentError && <div role="alert" style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 6 }}>{commentError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button disabled={posting || !newComment.trim()} onClick={postComment}
                  style={{ ...smallBtn, color: '#FFF', background: 'var(--ink)', border: 'none', opacity: posting || !newComment.trim() ? 0.5 : 1 }}>{posting ? 'Posting\u2026' : 'Post comment'}</button>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 16 }}>
              <span style={{ color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/login?redirect=/writing/' + id)}>Log in</span> to leave a comment.
            </div>
          )}
        </section>

        {more.length > 0 && <div style={{ marginTop: 40 }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 12 }}>More from {author?.first_name || 'this writer'}</div>
          {more.map(w => (
            <div key={w.id} onClick={() => router.push(`/writing/${w.id}`)} style={{ padding: '16px 0', borderTop: '1px solid var(--bd)', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...kicker, fontSize: 9 }}>{FORMAT_LABEL[w.format] || 'Writing'}</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25, marginTop: 4 }}>{w.title}</div>
              {w.subtitle && <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--txD)', marginTop: 2 }}>{w.subtitle}</div>}
              <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 6 }}>{dateLabel(w.published_at)} {'\u00B7'} {readMinutes(plainText(w.content))} min read</div>
              </div>
              {w.cover_url && <img src={w.cover_url} alt="" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
            </div>
          ))}
        </div>}
      </article>
    </div>
  )
}
