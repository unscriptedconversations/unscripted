import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { updateColor } from '../../lib/auth'
import Logo from '../../components/Logo'
import NotificationBell from '../../components/NotificationBell'
import Bookshelf from '../../components/Bookshelf'
import { createNotification } from '../../lib/notify'
import { olSearch } from '../../lib/olSearch'

const COLORS = ['#8B6E52', '#5E7A62', '#C27A5A', '#6B6590', '#52708B', '#7A5278', '#8B7E52', '#8B5E5E', '#8B6E6E']

function MemberAvatar({ member, size = 80 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: member?.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, fontFamily: 'var(--ui)', color: '#FFF', flexShrink: 0 }}>{member?.initials || '?'}</div>
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

const FORMAT_LABEL = { essay: 'Essay', reflection: 'Reflection', note: 'Note' }

function WritingCard({ w, onClick }) {
  const preview = w.content.length > 160 ? w.content.slice(0, 160) + '...' : w.content
  return (
    <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 24px', marginBottom: 12, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)' }}>{FORMAT_LABEL[w.format]}</span>
        {!w.is_published && <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)' }}>Draft</span>}
        <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 'auto' }}>{timeAgo(w.published_at || w.created_at)}</span>
      </div>
      <div style={{ fontFamily: 'var(--hd)', fontSize: 19, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 6 }}>{w.title}</div>
      <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6 }}>{preview}</div>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { id } = router.query
  const [member, setMember] = useState(null)
  const [writings, setWritings] = useState([])
  const [clubs, setClubs] = useState([])
  const [shelfItems, setShelfItems] = useState([])
  const [shelfLinks, setShelfLinks] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [listModal, setListModal] = useState(null)   // 'followers' | 'following'
  const [listMembers, setListMembers] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [tab, setTab] = useState('writing')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [accountModal, setAccountModal] = useState(null)   // 'disable' | 'delete'
  const [churnReasons, setChurnReasons] = useState([])
  const [churnNotes, setChurnNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [annoBook, setAnnoBook] = useState(null)
  const [annoList, setAnnoList] = useState([])
  const [annoLoading, setAnnoLoading] = useState(false)
  const [annoNote, setAnnoNote] = useState('')
  const [annoPassage, setAnnoPassage] = useState('')
  const [annoSaving, setAnnoSaving] = useState(false)
  const [showAddBook, setShowAddBook] = useState(false)
  const [abQ, setAbQ] = useState('')
  const [abR, setAbR] = useState([])
  const [abSel, setAbSel] = useState(null)
  const [abBusy, setAbBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).single()
      if (m) setCurrentUser(m)
    })
  }, [])

  useEffect(() => { if (id) load() }, [id])
  useEffect(() => { if (currentUser && id) checkFollowing() }, [currentUser, id])

  async function load() {
    const { data: m } = await supabase.from('members').select('*').eq('id', id).single()
    if (m) setMember(m)
    const { data: w } = await supabase.from('writings').select('*').eq('member_id', id).order('created_at', { ascending: false })
    if (w) setWritings(w)
    const { data: cm } = await supabase.from('club_members').select('pinned, club:clubs(id, name, description)').eq('member_id', id)
    if (cm) setClubs(cm.filter(x => x.club).map(x => ({ ...x.club, pinned: x.pinned })).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
    const { count } = await supabase.from('writing_follows').select('id', { count: 'exact', head: true }).eq('writer_member_id', id)
    setFollowerCount(count || 0)
    const { count: fc } = await supabase.from('writing_follows').select('id', { count: 'exact', head: true }).eq('follower_member_id', id)
    setFollowingCount(fc || 0)
    const { data: sh } = await supabase.from('shelves').select('title, author, book_key, status').eq('member_id', id).order('created_at', { ascending: false })
    setShelfItems(sh || [])
    const titles = (sh || []).map(s => s.title)
    if (titles.length) {
      const { data: bk } = await supabase.from('books').select('id, title').in('title', titles)
      const map = {}; for (const b of (bk || [])) map[b.title] = b.id
      setShelfLinks(map)
    }
  }

  async function reloadShelf() {
    const { data: sh } = await supabase.from('shelves').select('title, author, book_key, status').eq('member_id', id).order('created_at', { ascending: false })
    setShelfItems(sh || [])
    const titles = (sh || []).map(s => s.title)
    if (titles.length) {
      const { data: bk } = await supabase.from('books').select('id, title').in('title', titles)
      const map = {}; for (const b of (bk || [])) map[b.title] = b.id
      setShelfLinks(map)
    }
  }

  async function searchBooks(v) {
    setAbQ(v); setAbSel(null)
    if (v.trim().length < 2) { setAbR([]); return }
    try { setAbR(await olSearch(v)) } catch { setAbR([]) }
  }

  async function addToShelf(status) {
    if (!abSel || !member || abBusy) return
    setAbBusy(true)
    await supabase.from('shelves').upsert(
      { member_id: member.id, title: abSel.title, author: abSel.author || null, book_key: abSel.key || null, status },
      { onConflict: 'member_id,title' }
    )
    await reloadShelf()
    setAbBusy(false)
    setShowAddBook(false); setAbQ(''); setAbR([]); setAbSel(null)
  }

  async function checkFollowing() {
    const { data } = await supabase.from('writing_follows').select('id').eq('follower_member_id', currentUser.id).eq('writer_member_id', id).maybeSingle()
    setFollowing(!!data)
  }

  async function toggleFollow() {
    if (!currentUser) { router.push('/signup'); return }
    if (following) {
      await supabase.from('writing_follows').delete().eq('follower_member_id', currentUser.id).eq('writer_member_id', id)
      setFollowerCount(c => c - 1)
    } else {
      await supabase.from('writing_follows').insert({ follower_member_id: currentUser.id, writer_member_id: id })
      createNotification({ recipientId: id, actorId: currentUser.id, type: 'follow', link: `/profile/${currentUser.id}` })
      setFollowerCount(c => c + 1)
    }
    setFollowing(!following)
  }

  // Load the follower or following list for this profile (reads writing_follows both directions).
  async function openList(kind) {
    setListModal(kind); setListMembers([]); setListLoading(true)
    const col = kind === 'followers' ? 'writer_member_id' : 'follower_member_id'
    const other = kind === 'followers' ? 'follower_member_id' : 'writer_member_id'
    const { data: rows } = await supabase.from('writing_follows').select(other).eq(col, id)
    const ids = [...new Set((rows || []).map(r => r[other]).filter(Boolean))]
    if (ids.length) {
      const { data: ms } = await supabase.from('members').select('id, first_name, last_name, initials, color').in('id', ids).or('status.is.null,status.neq.disabled')
      setListMembers(ms || [])
    }
    setListLoading(false)
  }

  const CHURN_REASONS = [
    'Not enough time to read',
    'Couldn\u2019t find the right club',
    'Too many notifications',
    'Not what I expected',
    'Taking a break',
    'Something else',
  ]

  function toggleReason(r) {
    setChurnReasons(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])
  }

  // Reversible: hide the account, keep the data. Logging back in restores it.
  async function disableAccount() {
    setBusy(true)
    await supabase.from('members').update({ status: 'disabled', disabled_at: new Date().toISOString() }).eq('id', member.id)
    try { await supabase.auth.signOut({ scope: 'local' }) } catch (e) {}
    router.push('/')
  }

  // Permanent: record why (optional), then remove the profile row.
  async function deleteAccount() {
    setBusy(true)
    if (churnReasons.length || churnNotes.trim()) {
      await supabase.from('churn_feedback').insert({
        member_id: member.id,
        reasons: churnReasons,
        notes: churnNotes.trim() || null,
      })
    }
    await supabase.from('members').delete().eq('id', member.id)
    try { await supabase.auth.signOut({ scope: 'local' }) } catch (e) {}
    router.push('/')
  }

  if (!member) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  const isOwner = currentUser && currentUser.id === member.id

  async function togglePin(clubId, next) {
    setClubs(cs => cs.map(c => c.id === clubId ? { ...c, pinned: next } : c).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
    await supabase.from('club_members').update({ pinned: next }).eq('club_id', clubId).eq('member_id', currentUser.id)
  }

  async function openAnnotations(book) {
    setAnnoBook(book); setAnnoNote(''); setAnnoPassage(''); setAnnoList([]); setAnnoLoading(true)
    let q = supabase.from('annotations').select('*').eq('member_id', currentUser.id).order('created_at', { ascending: false })
    q = book.book_key ? q.eq('book_key', book.book_key) : q.eq('book_title', book.title)
    const { data } = await q
    setAnnoList(data || []); setAnnoLoading(false)
  }
  function closeAnnotations() { setAnnoBook(null); setAnnoNote(''); setAnnoPassage('') }
  async function addAnnotation() {
    const note = annoNote.trim()
    if (!note || !annoBook || !currentUser) return
    setAnnoSaving(true)
    const { data } = await supabase.from('annotations').insert({
      member_id: currentUser.id,
      book_key: annoBook.book_key || null,
      book_title: annoBook.title,
      book_author: annoBook.author || null,
      passage: annoPassage.trim() || null,
      note,
    }).select().single()
    if (data) { setAnnoList(l => [data, ...l]); setAnnoNote(''); setAnnoPassage('') }
    setAnnoSaving(false)
  }
  async function deleteAnnotation(aid) {
    await supabase.from('annotations').delete().eq('id', aid)
    setAnnoList(l => l.filter(a => a.id !== aid))
  }
  const published = writings.filter(w => w.is_published)
  const drafts = writings.filter(w => !w.is_published)

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{member.first_name} {member.last_name} — unscripted</title>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{isOwner && <NotificationBell currentUser={currentUser} />}{isOwner && <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }} onClick={() => router.push('/write')}>+ Write</button>}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          <div style={{ position: 'relative', cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && setShowColorPicker(p => !p)}>
            <MemberAvatar member={member} size={80} />
            {isOwner && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#FFF', border: '2px solid var(--bg)' }}>✎</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>{member.first_name} {member.last_name}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 4 }}><span onClick={() => openList('followers')} style={{ cursor: 'pointer' }}><b style={{ color: 'var(--ink)' }}>{followerCount}</b> follower{followerCount !== 1 ? 's' : ''}</span>{' · '}<span onClick={() => openList('following')} style={{ cursor: 'pointer' }}><b style={{ color: 'var(--ink)' }}>{followingCount}</b> following</span>{clubs.length > 0 ? ` · ${clubs.length} club${clubs.length !== 1 ? 's' : ''}` : ''}{shelfItems.length > 0 ? <span>{' · '}<b style={{ color: 'var(--ink)' }}>{shelfItems.length}</b> shelved</span> : ''}</div>
            {(() => { const r = shelfItems.find(s => s.status === 'reading'); if (!r) return null; const href = r.book_key ? `/book/${r.book_key}` : (shelfLinks[r.title] ? `/book/${shelfLinks[r.title]}` : null); return <div onClick={() => href && router.push(href)} style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 6, cursor: href ? 'pointer' : 'default' }}>Currently reading <span style={{ fontStyle: 'italic', color: 'var(--ink)', fontWeight: 600 }}>{r.title}</span></div> })()}
          </div>
          {!isOwner && <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: following ? 'var(--sg)' : '#FFF', background: following ? 'rgba(94,122,98,0.1)' : 'var(--ink)', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
        </div>

        {isOwner && showColorPicker && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {COLORS.map(c => (
              <div key={c} onClick={async () => { const { data } = await updateColor(member.id, c); if (data) setMember(data); setShowColorPicker(false) }} style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', border: member.color === c ? '3px solid var(--ink)' : '3px solid transparent' }} />
            ))}
          </div>
        )}

        <div style={{ marginBottom: 32 }} />

        {(isOwner || shelfItems.some(s => s.status === 'read' || s.status === 'reading')) && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)' }}>Bookshelf</div>
              {isOwner && <button onClick={() => setShowAddBook(true)} style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>+ Add book</button>}
            </div>
            <Bookshelf books={shelfItems.filter(s => s.status === 'read' || s.status === 'reading')} shelfLinks={shelfLinks} onSelectBook={isOwner ? openAnnotations : undefined} />
          </div>
        )}

        {shelfItems.some(s => s.status === 'want') && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 14 }}>Want to read</div>
            <Bookshelf books={shelfItems.filter(s => s.status === 'want')} shelfLinks={shelfLinks} />
          </div>
        )}

        <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)', marginBottom: 24 }}>
          {[['writing', 'Writing'], ['clubs', 'Clubs'], ...(isOwner ? [['account', 'Account']] : [])].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: tab === k ? 'var(--ink)' : 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px 12px 0', position: 'relative' }}>
              {l}{tab === k && <div style={{ position: 'absolute', bottom: -1, left: 0, right: 20, height: 2, background: 'var(--tc)', borderRadius: 2 }} />}
            </button>
          ))}
        </div>

        {tab === 'writing' && <div>
          {published.length > 0 ? published.map(w => <WritingCard key={w.id} w={w} onClick={() => router.push(`/writing/${w.id}`)} />) : <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', color: 'var(--txD)', padding: '24px 0' }}>{member.first_name} hasn't published anything yet.</div>}

          {isOwner && drafts.length > 0 && <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 16 }}>Your drafts</div>
            {drafts.map(w => <WritingCard key={w.id} w={w} onClick={() => router.push(`/write?id=${w.id}`)} />)}
          </div>}
        </div>}

        {isOwner && tab === 'account' && <div>
          <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 22px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Email</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>{member.email}</div>
          </div>

          <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#A0603E', margin: '28px 0 14px', paddingBottom: 10, borderBottom: '1px solid rgba(160,96,62,0.2)' }}>Danger Zone</div>

          <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 22px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Take a break</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 14 }}>Hide your profile and writing. Nothing is deleted \u2014 log back in any time to pick up where you left off.</div>
            <button onClick={() => setAccountModal('disable')} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '10px 18px', cursor: 'pointer' }}>Disable account</button>
          </div>

          <div style={{ background: 'var(--sf)', border: '1px solid rgba(160,96,62,0.25)', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: '#A0603E', marginBottom: 6 }}>Delete account</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 14 }}>Permanently removes your profile, writing, and posts. This can\u2019t be undone.</div>
            <button onClick={() => setAccountModal('delete')} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: '#A0603E', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer' }}>Delete my account</button>
          </div>
        </div>}

        {listModal && <div onClick={() => setListModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sf)', borderRadius: 18, padding: '24px 22px', maxWidth: 420, width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, textTransform: 'capitalize' }}>{listModal}</div>
            {listLoading ? <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Loading…</div>
              : listMembers.length === 0 ? <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>{listModal === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</div>
              : listMembers.map(m => (
                <div key={m.id} onClick={() => { setListModal(null); router.push(`/profile/${m.id}`) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', cursor: 'pointer' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: m.color || '#8B6E52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: '#FFF', flexShrink: 0 }}>{m.initials || (((m.first_name || '')[0] || '') + ((m.last_name || '')[0] || ''))}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{m.first_name} {m.last_name}</div>
                </div>
              ))}
          </div>
        </div>}

        {accountModal && <div onClick={() => !busy && setAccountModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sf)', borderRadius: 18, padding: '28px 26px', maxWidth: 460, width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
            {accountModal === 'disable' ? (<>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>Take a break?</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 24 }}>Your profile and writing will be hidden. Your clubs, posts, and streaks stay exactly as they are \u2014 just log back in whenever you\u2019re ready.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button disabled={busy} onClick={disableAccount} style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '13px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{busy ? 'Working\u2026' : 'Disable account'}</button>
                <button disabled={busy} onClick={() => setAccountModal(null)} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 22px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </>) : (<>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>Before you go</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 20 }}>This permanently deletes your account. If you\u2019d rather step away for a while, disabling keeps everything intact.</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10 }}>What led to this? (optional)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {CHURN_REASONS.map(r => (
                  <button key={r} onClick={() => toggleReason(r)} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: churnReasons.includes(r) ? 'var(--tc)' : 'var(--txD)', background: churnReasons.includes(r) ? 'var(--tcD)' : 'none', border: '1px solid ' + (churnReasons.includes(r) ? 'var(--tc)' : 'var(--bd2)'), borderRadius: 100, padding: '8px 14px', cursor: 'pointer' }}>{r}</button>
                ))}
              </div>
              <textarea value={churnNotes} onChange={e => setChurnNotes(e.target.value)} placeholder="Anything else you\u2019d want us to know?" rows={3} style={{ width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 22 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button disabled={busy} onClick={deleteAccount} style={{ flex: 1, fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: '#A0603E', border: 'none', borderRadius: 10, padding: '13px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{busy ? 'Deleting\u2026' : 'Delete forever'}</button>
                <button disabled={busy} onClick={() => { setAccountModal('disable'); }} style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 18px', cursor: 'pointer' }}>Disable instead</button>
              </div>
            </>)}
          </div>
        </div>}

        {tab === 'clubs' && <div>
          {clubs.length > 0 ? clubs.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 10, cursor: 'pointer' }} onClick={() => router.push(`/club/${c.id}`)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.pinned ? '📌 ' : ''}{c.name}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{c.description}</div>
              </div>
              {isOwner && <button onClick={e => { e.stopPropagation(); togglePin(c.id, !c.pinned) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: c.pinned ? 1 : 0.35, flexShrink: 0 }} aria-label={c.pinned ? 'Unpin' : 'Pin'}>📌</button>}
            </div>
          )) : <><div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', color: 'var(--txD)', padding: '24px 0' }}>Not in any clubs yet.</div><div style={{ marginTop: 16 }}><button style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 8, padding: '11px 20px', cursor: 'pointer' }} onClick={() => router.push('/create')}>Start a club</button></div></>}
        {annoBook && <div onClick={closeAnnotations} style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sf)', borderRadius: 18, padding: '24px 22px', maxWidth: 520, width: '100%', maxHeight: '82vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 4 }}>Annotations</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{annoBook.title}</div>
                {annoBook.author && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginTop: 2 }}>{annoBook.author}</div>}
              </div>
              <button onClick={closeAnnotations} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--txD)', fontSize: 22, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', lineHeight: 1.5, margin: '10px 0 18px' }}>Private to you — like writing in the margins. Add a note, and optionally the passage it refers to.</div>
            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, marginBottom: 18 }}>
              <textarea value={annoPassage} onChange={e => setAnnoPassage(e.target.value)} placeholder="Passage or quote (optional)" rows={2} style={{ width: '100%', fontFamily: 'var(--hd)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
              <textarea value={annoNote} onChange={e => setAnnoNote(e.target.value)} placeholder="Your note…" rows={3} style={{ width: '100%', fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={addAnnotation} disabled={!annoNote.trim() || annoSaving} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', opacity: (!annoNote.trim() || annoSaving) ? 0.5 : 1 }}>{annoSaving ? 'Saving…' : 'Add annotation'}</button>
              </div>
            </div>
            {annoLoading ? <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '8px 0' }}>Loading…</div>
              : annoList.length === 0 ? <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontStyle: 'italic', color: 'var(--txD)', padding: '8px 0' }}>No annotations yet. Add your first margin note above.</div>
              : <div style={{ display: 'grid', gap: 12 }}>
                  {annoList.map(a => (
                    <div key={a.id} style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
                      <button onClick={() => deleteAnnotation(a.id)} aria-label="Delete" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--txD)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>×</button>
                      {a.passage && <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink)', borderLeft: '3px solid var(--tc)', paddingLeft: 12, marginBottom: 8, lineHeight: 1.5 }}>{a.passage}</div>}
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingRight: 16 }}>{a.note}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 8 }}>{new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    </div>
                  ))}
                </div>}
          </div>
        </div>}

        {showAddBook && <div onClick={() => !abBusy && setShowAddBook(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sf)', borderRadius: 18, padding: '24px 22px', maxWidth: 520, width: '100%', marginTop: '6vh', maxHeight: '82vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 4 }}>Add to shelf</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>Find a book</div>
              </div>
              <button onClick={() => setShowAddBook(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--txD)', fontSize: 22, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
            <input autoFocus value={abQ} onChange={e => searchBooks(e.target.value)} placeholder="Search a title or author…" style={{ width: '100%', fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 10, padding: '11px 13px', boxSizing: 'border-box', margin: '14px 0 12px' }} />
            {abR.length > 0 && <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
              {abR.map((b, i) => (
                <div key={(b.key || b.title) + i} onClick={() => setAbSel(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid ' + (abSel && (abSel.key || abSel.title) === (b.key || b.title) ? 'var(--tc)' : 'var(--bd)'), background: abSel && (abSel.key || abSel.title) === (b.key || b.title) ? 'rgba(194,122,90,0.06)' : 'var(--bg)' }}>
                  {b.cover ? <img src={`https://covers.openlibrary.org/b/id/${b.cover}-S.jpg`} alt="" style={{ width: 34, height: 50, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} /> : <div style={{ width: 34, height: 50, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 3, flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    {b.author && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>}
                  </div>
                </div>
              ))}
            </div>}
            {abQ.trim().length >= 2 && abR.length === 0 && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', padding: '4px 2px 14px' }}>No matches — try a different title.</div>}
            {abSel && <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 10 }}>Add <span style={{ fontStyle: 'italic', color: 'var(--ink)', fontWeight: 600 }}>{abSel.title}</span> as</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['want', 'Want to read'], ['reading', 'Currently reading'], ['read', 'Read']].map(([s, l]) => (
                  <button key={s} disabled={abBusy} onClick={() => addToShelf(s)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 8, padding: '11px 16px', cursor: abBusy ? 'default' : 'pointer', opacity: abBusy ? 0.5 : 1 }}>{l}</button>
                ))}
              </div>
            </div>}
          </div>
        </div>}
        </div>}
      </div>
    </div>
  )
}
