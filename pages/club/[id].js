           import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { FIGURES, getFigure } from '../../lib/figures'
import Logo from '../../components/Logo'
import Tag from '../../components/Tag'

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

function progressColor(pct) {
  if (pct >= 80) return '#5E7A62'
  if (pct >= 50) return '#7A9A7E'
  if (pct >= 25) return '#C27A5A'
  return '#B0A594'
}

function MemberAvatar({ member, size = 36 }) {
  const fig = member?.avatar_figure ? getFigure(member.avatar_figure) : null
  if (fig) return <div style={{width:size,height:size,borderRadius:'50%',background:fig.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.5,flexShrink:0,border:'2px solid rgba(255,255,255,0.15)',cursor:'pointer'}}>{fig.icon}</div>
  return <div style={{width:size,height:size,borderRadius:'50%',background:member?.color||'#8B6E52',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.31,fontWeight:700,fontFamily:'var(--ui)',color:'#FFF',flexShrink:0,border:'2px solid rgba(255,255,255,0.15)',cursor:'pointer'}}>{member?.initials||'?'}</div>
}

function ThemePill({ t, active, onClick }) {
  return <span onClick={onClick} style={{fontFamily:'var(--ui)',fontSize:10,fontWeight:600,letterSpacing:1,color:active?'var(--tc)':'var(--txM)',background:active?'var(--tcD)':'var(--sf2)',border:'1px solid '+(active?'var(--tc)':'var(--bd)'),borderRadius:100,padding:'4px 14px',cursor:onClick?'pointer':'default'}}>{t}</span>
}

export default function ClubPage() {
  const router = useRouter()
  const { id } = router.query

  const [club, setClub] = useState(null)
  const [members, setMembers] = useState([])
  const [books, setBooks] = useState([])
  const [threads, setThreads] = useState([])
  const [posts, setPosts] = useState([])
  const [likes, setLikes] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [view, setView] = useState('feed')
  const [selBook, setSelBook] = useState(null)
  const [discMode, setDiscMode] = useState('chapters')
  const [filterTheme, setFilterTheme] = useState(null)
  const [newPost, setNewPost] = useState('')
  const [newSit, setNewSit] = useState('')
  const [newThemes, setNewThemes] = useState('')
  const [profileMember, setProfileMember] = useState(null)
  const [activeThread, setActiveThread] = useState(null)
  const [threadPosts, setThreadPosts] = useState([])
  const [threadNewPost, setThreadNewPost] = useState('')
  const [threadNewSit, setThreadNewSit] = useState('')
  const [threadNewThemes, setThreadNewThemes] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplies, setExpandedReplies] = useState({})
  const [showAddBook, setShowAddBook] = useState(false)
  const [bkQ, setBkQ] = useState('')
  const [bkR, setBkR] = useState([])
  const [bkL, setBkL] = useState(false)
  const [newBook, setNewBook] = useState({ title: '', author: '', chapters: '', noCh: false })
  const timer = useRef(null)

  // Settings form state
  const [memberships, setMemberships] = useState([])
  const [settingsName, setSettingsName] = useState('')
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  // Settings form state
  const [memberships, setMemberships] = useState([])
  useEffect(() => {
    // Load session from Supabase Auth (replaces localStorage)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: member } = await supabase
        .from('members').select('*').eq('id', session.user.id).single()
      if (member) setCurrentUser(member)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data: member } = await supabase
          .from('members').select('*').eq('id', session.user.id).single()
        if (member) setCurrentUser(member)
      } else {
        setCurrentUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (id) loadClub() }, [id])

  async function loadClub() {
    const { data: c } = await supabase.from('clubs').select('*').eq('id', id).single()
    if (c) { setClub(c); setSettingsName(c.name || ''); setSettingsDesc(c.description || '') }
    const { data: cm } = await supabase.from('club_members').select('*, member:members(*)').eq('club_id', id)
    if (cm) {
      setMembers(cm.map(x => x.member).filter(Boolean))
      setMemberships(cm) // store full membership data including role
    }
    const { data: bk } = await supabase.from('books').select('*').eq('club_id', id).order('display_order')
    if (bk) { setBooks(bk); if (!selBook && bk[0]) setSelBook(bk[0].id) }
    const { data: th } = await supabase.from('threads').select('*').order('chapter_number')
    if (th) setThreads(th)
    const { data: ps } = await supabase.from('posts').select('*, member:members(*)').eq('club_id', id).order('created_at', { ascending: false })
    if (ps) setPosts(ps)
    const { data: lk } = await supabase.from('likes').select('*')
    if (lk) setLikes(lk)
  }

  async function loadThreadPosts(threadId) {
    const { data } = await supabase.from('thread_replies').select('*, member:members(*)').eq('thread_id', threadId).order('created_at')
    if (data) setThreadPosts(data)
  }

  async function submitPost() {
    if (!newPost.trim() || !currentUser) return
    const tag = document.getElementById('club-tag-select')?.value || 'community'
    await supabase.from('posts').insert({ member_id: currentUser.id, content: newPost.trim(), tag, sitting_with: newSit.trim() || null, themes: newThemes.trim() || null, club_id: id })
    setNewPost(''); setNewSit(''); setNewThemes(''); loadClub()
  }

  async function submitThreadPost() {
    if (!threadNewPost.trim() || !currentUser || !activeThread) return
    await supabase.from('thread_replies').insert({ thread_id: activeThread.id, member_id: currentUser.id, content: threadNewPost.trim(), sitting_with: threadNewSit.trim() || null, themes: threadNewThemes.trim() || null })
    setThreadNewPost(''); setThreadNewSit(''); setThreadNewThemes(''); loadThreadPosts(activeThread.id)
  }

  async function submitReply(parentId) {
    if (!replyText.trim() || !currentUser || !activeThread) return
    await supabase.from('thread_replies').insert({ thread_id: activeThread.id, member_id: currentUser.id, content: replyText.trim(), parent_reply_id: parentId })
    setReplyText(''); setReplyingTo(null); setExpandedReplies(p => ({ ...p, [parentId]: true })); loadThreadPosts(activeThread.id)
  }

  async function toggleLike(postId) {
    if (!currentUser) return
    const ex = likes.find(l => l.post_id === postId && l.member_id === currentUser.id)
    if (ex) await supabase.from('likes').delete().eq('id', ex.id)
    else await supabase.from('likes').insert({ post_id: postId, member_id: currentUser.id })
    loadClub()
  }

  function searchBook(val) {
    setBkQ(val)
    if (timer.current) clearTimeout(timer.current)
    if (val.length < 3) { setBkR([]); return }
    setBkL(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(val)}&limit=5&fields=title,author_name,first_publish_year,cover_i`)
        const d = await r.json()
        setBkR((d.docs || []).map(b => ({ title: b.title, author: (b.author_name || [])[0] || 'Unknown', year: b.first_publish_year, cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null })))
      } catch (e) { setBkR([]) }
      setBkL(false)
    }, 400)
  }

  async function addBook() {
    if (!newBook.title) return
    await supabase.from('books').update({ status: 'completed' }).eq('club_id', id).eq('status', 'current')
    const chapters = newBook.noCh ? 0 : parseInt(newBook.chapters) || 0
    const { data: book } = await supabase.from('books').insert({ title: newBook.title, author: newBook.author, total_chapters: chapters, current_chapter: 0, status: 'current', display_order: books.length + 1, club_id: id }).select().single()
    if (book && chapters > 0) {
      const ins = Array.from({ length: chapters }, (_, i) => ({ book_id: book.id, chapter_number: i + 1, title: `Chapter ${i + 1}`, is_active: true }))
      ins.push({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${newBook.title}`, is_active: true })
      await supabase.from('threads').insert(ins)
    } else if (book) {
      await supabase.from('threads').insert({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${newBook.title}`, is_active: true })
    }
    setShowAddBook(false); setNewBook({ title: '', author: '', chapters: '', noCh: false }); setBkQ(''); setBkR([]); loadClub()
  }

  async function saveClubSettings() {
    if (!club || !isHost) return
    const { error } = await supabase.from('clubs').update({
      name: settingsName.trim(),
      description: settingsDesc.trim(),
    }).eq('id', id)
    if (!error) {
      setClub(prev => ({ ...prev, name: settingsName.trim(), description: settingsDesc.trim() }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    }
  }

  async function leaveClub() {
    if (!currentUser) return
    await supabase.from('club_members').delete()
      .eq('club_id', id).eq('member_id', currentUser.id)
    await supabase.auth.signOut()
    router.push('/')
  }

  async function copyInviteLink() {
    const link = `${window.location.origin}/join/${club.invite_code}`
    try { await navigator.clipboard.writeText(link) } catch { }
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const isLiked = pid => currentUser && likes.some(l => l.post_id === pid && l.member_id === currentUser.id)
  const likeCount = pid => likes.filter(l => l.post_id === pid).length
  const parseThemes = str => (str || '').split(',').map(t => t.trim()).filter(Boolean)

  const openThread = t => { setActiveThread(t); setView('thread'); setReplyingTo(null); setExpandedReplies({}); loadThreadPosts(t.id) }
  const openProfile = m => { setProfileMember(m); setView('profile') }

  const currentMembership = memberships.find(m => m.member_id === currentUser?.id)
  const isHost = currentMembership?.role === 'host' || club?.creator_id === currentUser?.id
  const isMember = !!currentMembership

  const curBook = books.find(b => b.status === 'current') || books[0]
  const activeBook = books.find(b => b.id === selBook) || curBook
  const activeChapterThreads = threads.filter(t => activeBook && t.book_id === activeBook.id && t.chapter_number > 0)
  const activeOpenThread = threads.find(t => activeBook && t.book_id === activeBook.id && t.chapter_number === 0)
  const allFeedThemes = [...new Set(posts.flatMap(p => parseThemes(p.themes)))]
  const filteredPosts = filterTheme ? posts.filter(p => (p.themes || '').toLowerCase().includes(filterTheme.toLowerCase())) : posts
  const topLevelTP = threadPosts.filter(p => !p.parent_reply_id)
  const tReplies = threadPosts.filter(p => p.parent_reply_id)
  const getReplies = pid => tReplies.filter(r => r.parent_reply_id === pid)
  const tThemes = [...new Set(topLevelTP.flatMap(p => parseThemes(p.themes)))]

  if (!club) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--ui)', color: 'var(--txD)' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>{club.name} — unscripted</title>

      {/* ADD BOOK MODAL */}
      {showAddBook && <div className="modal-overlay" onClick={() => setShowAddBook(false)}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowAddBook(false)}>×</button>
          <h2 className="modal-title" style={{ fontSize: 28 }}>Add a new book</h2>
          <p className="modal-sub">This becomes the current read. Previous books move to completed.</p>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <label className="field-label">Search for a book</label>
            <input className="field-input" style={{ marginBottom: 0 }} placeholder="Start typing a title..." value={bkQ} onChange={e => searchBook(e.target.value)} />
            {(bkR.length > 0 || bkL) && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
              {bkL && <div style={{ padding: '16px 20px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Searching...</div>}
              {bkR.map((b, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }} onClick={() => { setNewBook(d => ({ ...d, title: b.title, author: b.author })); setBkQ(''); setBkR([]) }}>
                {b.cover ? <img src={b.cover} style={{ width: 32, height: 44, borderRadius: 4, objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 20 }}>📖</span>}
                <div><div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{b.title}</div><div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}{b.year ? ` · ${b.year}` : ''}</div></div>
              </div>)}
            </div>}
          </div>
          {newBook.title && <div style={{ background: 'var(--sf2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{newBook.title}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 12 }}>{newBook.author}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', marginBottom: newBook.noCh ? 0 : 16 }}>
              <input type="checkbox" checked={newBook.noCh} onChange={e => setNewBook(d => ({ ...d, noCh: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--tc)' }} />No numbered chapters
            </label>
            {!newBook.noCh && <div style={{ marginTop: 16 }}><label className="field-label">How many chapters?</label><input className="field-input" style={{ marginBottom: 0 }} type="number" placeholder="e.g. 12" value={newBook.chapters} onChange={e => setNewBook(d => ({ ...d, chapters: e.target.value }))} /></div>}
          </div>}
          <button className="modal-submit" onClick={addBook}>Add book</button>
        </div>
      </div>}

      <div className="shell">
        {/* NAV */}
        <nav className="topnav">
          <div className="brand" onClick={() => router.push('/')}><Logo /></div>
          <div className="nav-links">
            <button className="nav-btn" onClick={() => router.push('/')}>Explore</button>
            <button className="nav-btn active">{club.name}</button>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="user-nav" onClick={() => { setProfileMember(currentUser); setView('profile') }}>
                  <MemberAvatar member={currentUser} size={32} />
                  <span className="user-nav-name">{currentUser.first_name}</span>
                </div>
                <button
                  onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
                  style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, letterSpacing: 1, color: 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  Log out
                </button>
              </div>
            ) : (
              <button className="join-btn" onClick={() => router.push('/login')}>Log in</button>
            )}
          </div>
        </nav>

        {/* CLUB HEADER */}
        <div style={{ padding: '40px 0 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span className="tag" style={{ background: club.privacy === 'open' ? 'rgba(94,122,98,0.1)' : 'var(--tcD)', color: club.privacy === 'open' ? 'var(--sg)' : 'var(--tc)' }}>{club.privacy}</span>
            {club.featured && <span className="tag" style={{ background: 'var(--tcD)', color: 'var(--tc)' }}>featured</span>}
          </div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 36, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{club.name}</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)' }}>{club.description}</div>
          {club.tagline && <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', color: 'var(--tc)', marginTop: 4 }}>{club.tagline}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingBottom: 20, borderBottom: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex' }}>{members.slice(0, 6).map((m, i) => <div key={m.id} style={{ marginLeft: i ? -6 : 0 }}><MemberAvatar member={m} size={28} /></div>)}</div>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>{members.length} members</span>
          </div>
        </div>

        {/* CLUB TABS */}
        <div className="club-tab-nav" style={{ marginBottom: 32 }}>
          {[
            ['feed', 'Feed'],
            ['disc', 'Bookshelf'],
            ['members', 'Members'],
            ...(isMember || isHost ? [['settings', 'Settings']] : []),
          ].map(([k, l]) =>
            <button key={k} className={`nav-btn ${view === k ? 'active' : ''}`} style={{ padding: '14px 24px' }} onClick={() => { setView(k); setActiveThread(null); setProfileMember(null) }}>{l}</button>
          )}
        </div>

        {/* FEED */}
        {view === 'feed' && <div className="main-grid" style={{ paddingBottom: 80 }}>
          <div>
            <div className="section-title" style={{ marginBottom: 20 }}>The Feed</div>
            {allFeedThemes.length > 0 && <div className="theme-filter"><span className="section-title" style={{ marginRight: 8 }}>Themes</span><ThemePill t="All" active={!filterTheme} onClick={() => setFilterTheme(null)} />{allFeedThemes.map(t => <ThemePill key={t} t={t} active={filterTheme === t} onClick={() => setFilterTheme(filterTheme === t ? null : t)} />)}</div>}
            {currentUser ? <div className="compose"><div className="compose-row"><MemberAvatar member={currentUser} size={36} /><textarea className="compose-input" placeholder="Say what's on your mind..." value={newPost} onChange={e => setNewPost(e.target.value)} rows={2} /></div><div className="compose-depth"><div className="compose-depth-label">Optional — add depth</div><div className="compose-depth-row"><span className="compose-depth-name">Sitting with</span><input className="compose-depth-input italic" placeholder="A line from the book..." value={newSit} onChange={e => setNewSit(e.target.value)} /></div><div className="compose-depth-row"><span className="compose-depth-name">Themes</span><input className="compose-depth-input" placeholder="survival, identity (comma separated)" value={newThemes} onChange={e => setNewThemes(e.target.value)} /></div></div><div className="compose-foot"><select className="tag-select" id="club-tag-select"><option value="community">Community</option><option value="reflection">Reflection</option><option value="book">Book</option></select><button className="share-btn" disabled={!newPost.trim()} onClick={submitPost}>Share</button></div></div> : <div className="compose compose-cta" onClick={() => router.push('/signup')}><p className="compose-placeholder">Join to share your thoughts...</p></div>}
            {filteredPosts.map(p => { const m = p.member || {}; const th = parseThemes(p.themes); return <div key={p.id} className="feed-card"><div className="feed-header"><MemberAvatar member={m} size={32} /><div><span className="feed-name" onClick={() => openProfile(m)}>{m.first_name}</span><span className="feed-time">{timeAgo(p.created_at)}</span></div><span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span></div><div className="feed-body">{p.content}</div>{p.sitting_with && <div className="sitting-with"><div className="sitting-label">Sitting with</div><div className="sitting-text">"{p.sitting_with}"</div></div>}{th.length > 0 && <div className="theme-pills">{th.map(t => <ThemePill key={t} t={t} active={filterTheme === t} onClick={() => setFilterTheme(filterTheme === t ? null : t)} />)}</div>}<div className="feed-actions"><button className={`feed-action ${isLiked(p.id) ? 'liked' : ''}`} onClick={() => toggleLike(p.id)}>{isLiked(p.id) ? '\u2665' : '\u2661'} {likeCount(p.id)}</button></div></div> })}
          </div>
          <div className="sidebar">
            {curBook && <div className="sidebar-section"><div className="sidebar-label">Currently Reading</div><div className="book-card" style={{ cursor: 'pointer' }} onClick={() => setView('disc')}><div className="book-card-inner" style={{ padding: 24 }}><div className="book-title" style={{ fontSize: 20 }}>{curBook.title}</div><div className="book-author" style={{ marginBottom: 12 }}>{curBook.author}</div></div></div></div>}
            <div className="sidebar-section"><div className="sidebar-label">Books ({books.length})</div>{books.map(b => <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 6, cursor: 'pointer' }} onClick={() => { setSelBook(b.id); setView('disc') }}><span className="tag" style={{ background: b.status === 'current' ? 'var(--tcD)' : 'rgba(94,122,98,0.1)', color: b.status === 'current' ? 'var(--tc)' : 'var(--sg)' }}>{b.status === 'current' ? 'now' : 'done'}</span><span style={{ fontFamily: 'var(--hd)', fontSize: 13, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)', flex: 1 }}>{b.title}</span></div>)}<button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', width: '100%', marginTop: 8 }} onClick={() => setShowAddBook(true)}>+ Add book</button></div>
          </div>
        </div>}

        {/* BOOKSHELF / DISCUSSIONS */}
        {view === 'disc' && <div style={{ paddingBottom: 80 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><div className="section-title">Bookshelf</div><button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }} onClick={() => setShowAddBook(true)}>+ Add book</button></div>
          <div className="shelf">{books.map(b => <div key={b.id} className={`shelf-item ${selBook === b.id ? 'active' : ''}`} onClick={() => { setSelBook(b.id); setDiscMode('chapters') }}><div className={`shelf-title ${selBook === b.id ? 'inv' : ''}`}>{b.title}</div><div className={`shelf-author ${selBook === b.id ? 'inv' : ''}`}>{b.author}</div><span className="tag" style={{ background: b.status === 'current' ? (selBook === b.id ? 'rgba(194,122,90,0.25)' : 'var(--tcD)') : (selBook === b.id ? 'rgba(94,122,98,0.25)' : 'rgba(94,122,98,0.1)'), color: b.status === 'current' ? 'var(--tc)' : 'var(--sg)', width: 'fit-content', marginTop: 4 }}>{b.status === 'current' ? 'Reading Now' : 'Completed'}</span></div>)}</div>

          {activeBook && <>
            <div className="disc-header"><div className="disc-title">{activeBook.title}</div></div>
            <div className="disc-meta">by {activeBook.author} · {activeChapterThreads.length} threads{activeOpenThread ? ' · Open discussion' : ''}</div>

            {activeBook.status === 'completed' && activeOpenThread && <div className="mode-toggle"><button className={`mode-btn ${discMode === 'chapters' ? 'act' : ''}`} onClick={() => setDiscMode('chapters')}>By Chapter</button><button className={`mode-btn ${discMode === 'open' ? 'act' : ''}`} onClick={() => setDiscMode('open')}>Open Discussion</button></div>}

            {/* Open Discussion always visible at top */}
            {activeOpenThread && discMode === 'chapters' && <div className="open-card" style={{ marginBottom: 20 }} onClick={() => openThread(activeOpenThread)}><div className="open-card-row"><div className="open-icon">💬</div><div className="open-info"><div className="open-title">Open Discussion</div><div className="open-meta">Full conversation — no boundaries</div></div><span className="thread-arrow">→</span></div></div>}

            {(discMode === 'chapters' || activeBook.status === 'current') && activeChapterThreads.map(t => <div className="thread-card-lg" key={t.id} onClick={() => openThread(t)}><div className={`thread-badge ${t.is_active ? 'hot' : ''}`}>{t.chapter_number}</div><div className="thread-info"><div className="thread-info-title">{t.title}</div><div className="thread-info-meta">Open for discussion</div></div><span className="thread-arrow">→</span></div>)}

            {discMode === 'open' && activeOpenThread && <div className="open-card" onClick={() => openThread(activeOpenThread)}><div className="open-card-row"><div className="open-icon">💬</div><div className="open-info"><div className="open-title">{activeOpenThread.title}</div><div className="open-meta">All chapters · No spoiler walls</div></div><div className="open-enter">Enter</div></div><div className="open-desc">The full conversation — no chapter boundaries. Spoilers welcome.</div></div>}
          </>}
        </div>}

        {/* THREAD */}
        {view === 'thread' && activeThread && <div style={{ paddingBottom: 80 }}>
          <div className="thread-view-header">
            <button className="thread-view-back" onClick={() => setView('disc')}>← Back to bookshelf</button>
            <div className="thread-view-title">{activeThread.title}</div>
            <div className="thread-view-meta">{topLevelTP.length} posts · {tReplies.length} replies</div>
          </div>

          {currentUser && <div className="thread-compose"><div className="compose-row"><MemberAvatar member={currentUser} size={36} /><textarea className="compose-input" placeholder={`Share your thoughts...`} value={threadNewPost} onChange={e => setThreadNewPost(e.target.value)} rows={2} /></div><div className="compose-depth"><div className="compose-depth-label">Optional — add depth</div><div className="compose-depth-row"><span className="compose-depth-name">Sitting with</span><input className="compose-depth-input italic" placeholder="A line from the book..." value={threadNewSit} onChange={e => setThreadNewSit(e.target.value)} /></div><div className="compose-depth-row"><span className="compose-depth-name">Themes</span><input className="compose-depth-input" placeholder="survival, identity" value={threadNewThemes} onChange={e => setThreadNewThemes(e.target.value)} /></div></div><div className="compose-foot"><button className="share-btn" disabled={!threadNewPost.trim()} onClick={submitThreadPost}>Post to thread</button></div></div>}

          {tThemes.length > 0 && <div className="theme-filter">{tThemes.map(t => <ThemePill key={t} t={t} />)}</div>}

          {topLevelTP.length > 0 ? topLevelTP.map(po => { const m = po.member || {}; const th = parseThemes(po.themes); const reps = getReplies(po.id); return <div key={po.id} style={{ marginBottom: 24 }}>
            <div className="feed-card"><div className="feed-header"><MemberAvatar member={m} size={32} /><div><span className="feed-name" onClick={() => openProfile(m)}>{m.first_name}</span><span className="feed-time">{timeAgo(po.created_at)}</span></div></div><div className="feed-body">{po.content}</div>{po.sitting_with && <div className="sitting-with"><div className="sitting-label">Sitting with</div><div className="sitting-text">"{po.sitting_with}"</div></div>}{th.length > 0 && <div className="theme-pills">{th.map(t => <ThemePill key={t} t={t} />)}</div>}
            <div className="feed-actions"><button className="feed-action" onClick={() => { setReplyingTo(replyingTo === po.id ? null : po.id); setReplyText('') }}>↩ Reply</button>{reps.length > 0 && <button className="feed-action" style={{ marginLeft: 'auto' }} onClick={() => setExpandedReplies(p => ({ ...p, [po.id]: !p[po.id] }))}>{expandedReplies[po.id] ? 'Hide' : 'Show'} {reps.length} {reps.length === 1 ? 'reply' : 'replies'}</button>}</div></div>

            {replyingTo === po.id && currentUser && <div className="reply-compose"><div style={{ display: 'flex', gap: 12 }}><MemberAvatar member={currentUser} size={28} /><div style={{ flex: 1 }}><div className="reply-to-label">Replying to {m.first_name}</div><textarea className="reply-input" placeholder="Write your reply..." value={replyText} onChange={e => setReplyText(e.target.value)} autoFocus rows={2} /></div></div><div className="reply-actions"><button className="reply-cancel" onClick={() => setReplyingTo(null)}>Cancel</button><button className="reply-submit" style={{ opacity: replyText.trim() ? 1 : 0.4 }} onClick={() => submitReply(po.id)}>Reply</button></div></div>}

            {(expandedReplies[po.id] || replyingTo === po.id) && reps.length > 0 && <div className="replies-list">{reps.map(r => { const rm = r.member || {}; return <div key={r.id} className="reply-card"><div className="reply-header"><MemberAvatar member={rm} size={24} /><span className="reply-name">{rm.first_name}</span><span className="reply-time">{timeAgo(r.created_at)}</span></div><div className="reply-body">{r.content}</div></div> })}</div>}
          </div> }) : <div className="empty-state"><div className="empty-title">No posts yet</div><div className="empty-sub">Be the first to share your thoughts.</div></div>}
        </div>}

        {/* MEMBERS */}
        {view === 'members' && <div style={{ paddingBottom: 80 }}>
          <div className="section-title" style={{ marginBottom: 20 }}>Members ({members.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {members.map(m => <div key={m.id} className="feed-card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => openProfile(m)}>
              <MemberAvatar member={m} size={52} />
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 14 }}>{m.first_name} {m.last_name}</div>
              {m.avatar_figure && <div style={{ fontFamily: 'var(--hd)', fontSize: 12, fontStyle: 'italic', color: 'var(--txD)', marginTop: 4 }}>{getFigure(m.avatar_figure).name}</div>}
            </div>)}
          </div>
        </div>}

        {/* SETTINGS */}
        {view === 'settings' && <div style={{ maxWidth: 560, paddingBottom: 80 }}>
          <div className="section-title" style={{ marginBottom: 36 }}>Settings</div>

          {/* ── SECTION 1: Club Info (host only) ─────────────────────── */}
          {isHost && <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>Club Info</div>
            <label className="field-label">Club Name</label>
            <input className="field-input" value={settingsName} onChange={e => setSettingsName(e.target.value)} />
            <label className="field-label">Description</label>
            <textarea className="field-input" value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            <button
              onClick={saveClubSettings}
              style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: settingsSaved ? 'var(--sg)' : 'var(--ink)', border: 'none', borderRadius: 10, padding: '13px 28px', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              {settingsSaved ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>}

          {/* ── SECTION 2: Privacy & Invite ──────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>Privacy & Invite</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {['invite', 'open'].map(p => (
                <div key={p}
                  style={{ flex: 1, padding: '16px 20px', borderRadius: 12, border: club.privacy === p ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: club.privacy === p ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: isHost ? 'pointer' : 'default', textAlign: 'center', opacity: isHost ? 1 : 0.7 }}
                  onClick={async () => {
                    if (!isHost) return
                    await supabase.from('clubs').update({ privacy: p }).eq('id', id)
                    setClub(prev => ({ ...prev, privacy: p }))
                  }}
                >
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p === 'invite' ? 'Invite Only' : 'Open'}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{p === 'invite' ? 'Members join via link' : 'Anyone can find & join'}</div>
                </div>
              ))}
            </div>
            <label className="field-label">Invite Link</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txM)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeof window !== 'undefined' ? window.location.origin : 'https://www.unscriptedbook.club'}/join/{club.invite_code}
              </div>
              <button
                onClick={copyInviteLink}
                style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: inviteCopied ? 'var(--sg)' : 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '12px 18px', cursor: 'pointer', flexShrink: 0, transition: 'color 0.2s', minWidth: 80 }}
              >
                {inviteCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* ── SECTION 3: Members (host only) ───────────────────────── */}
          {isHost && <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>Members</div>
            {members.filter(m => m.id !== currentUser?.id).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--bd)' }}>
                <MemberAvatar member={m} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{m.first_name} {m.last_name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{memberships.find(ms => ms.member_id === m.id)?.role || 'member'}</div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${m.first_name} from this club?`)) return
                    await supabase.from('club_members').delete().eq('club_id', id).eq('member_id', m.id)
                    loadClub()
                  }}
                  style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 600, color: 'var(--txD)', background: 'none', border: '1px solid var(--bd2)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>}

          {/* ── SECTION 4: Danger Zone ────────────────────────────────── */}
          <div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#A0603E', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(160,96,62,0.2)' }}>Danger Zone</div>
            {!leaveConfirm ? (
              <button
                onClick={() => setLeaveConfirm(true)}
                style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#A0603E', background: 'rgba(160,96,62,0.06)', border: '1.5px solid rgba(160,96,62,0.3)', borderRadius: 10, padding: '13px 24px', cursor: 'pointer', width: '100%' }}
              >
                Leave this club
              </button>
            ) : (
              <div style={{ background: 'rgba(160,96,62,0.06)', border: '1.5px solid rgba(160,96,62,0.2)', borderRadius: 14, padding: '24px' }}>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Are you sure?</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 20 }}>
                  Your posts will stay but you'll need a new invite to rejoin {club.name}.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={leaveClub}
                    style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: '#A0603E', border: 'none', borderRadius: 10, padding: '13px 24px', cursor: 'pointer', flex: 1 }}
                  >
                    Yes, leave club
                  </button>
                  <button
                    onClick={() => setLeaveConfirm(false)}
                    style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 24px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>}

        {/* PROFILE */}
        {view === 'profile' && profileMember && <div style={{ paddingBottom: 80 }}>
          <button className="profile-back" onClick={() => setView('feed')}>← Back</button>
          <div className="profile-header"><MemberAvatar member={profileMember} size={88} /><div><div className="profile-name">{profileMember.first_name} {profileMember.last_name}</div><div className="profile-role">{profileMember.role || 'Member'}</div>{profileMember.avatar_figure && <div className="profile-figure">{getFigure(profileMember.avatar_figure).name}</div>}</div></div>
          {(profileMember.fav_book || profileMember.one_word || profileMember.fav_cartoon) ? <div className="bio-grid">
            <div className="bio-card"><div className="bio-accent" style={{ background: 'var(--tc)' }} /><div className="bio-label">Favorite Book</div>{profileMember.fav_book ? <><div className="bio-book-title">{profileMember.fav_book}</div><div className="bio-book-author">{profileMember.fav_book_author}</div></> : <div className="bio-empty">Not shared yet</div>}</div>
            <div className="bio-card"><div className="bio-accent" style={{ background: 'var(--sg)' }} /><div className="bio-label">In one word</div>{profileMember.one_word ? <div className="bio-word">{profileMember.one_word}</div> : <div className="bio-empty">Not shared yet</div>}</div>
            <div className="bio-card"><div className="bio-accent" style={{ background: '#6B6590' }} /><div className="bio-label">Cartoon Character</div>{profileMember.fav_cartoon ? <div className="bio-cartoon">{profileMember.fav_cartoon}</div> : <div className="bio-empty">Not shared yet</div>}</div>
          </div> : <div className="bio-empty-state"><div className="bio-empty-title">{profileMember.first_name} hasn't filled out their profile yet</div></div>}
          <div className="section-title" style={{ marginBottom: 20 }}>Posts by {profileMember.first_name}</div>
          {posts.filter(p => p.member_id === profileMember.id).map(p => { const th = parseThemes(p.themes); return <div key={p.id} className="feed-card"><div className="feed-header"><MemberAvatar member={profileMember} size={32} /><div><span className="feed-name">{profileMember.first_name}</span><span className="feed-time">{timeAgo(p.created_at)}</span></div><span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span></div><div className="feed-body">{p.content}</div>{p.sitting_with && <div className="sitting-with"><div className="sitting-label">Sitting with</div><div className="sitting-text">"{p.sitting_with}"</div></div>}{th.length > 0 && <div className="theme-pills">{th.map(t => <ThemePill key={t} t={t} />)}</div>}</div> })}
          {posts.filter(p => p.member_id === profileMember.id).length === 0 && <div className="profile-no-posts">{profileMember.first_name} hasn't posted yet — but they're reading.</div>}
        </div>}
      </div>
    </div>
  )
}
