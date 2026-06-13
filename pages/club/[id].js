import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { FIGURES, getFigure } from '../../lib/figures'
import Logo from '../../components/Logo'
import Tag from '../../components/Tag'
import BookSearch from '../../components/BookSearch'

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
  const [newBook, setNewBook] = useState({ title: '', author: '', chapters: '', noCh: false })

  useEffect(() => {
    try { const sv = window.localStorage?.getItem?.('unscripted_user'); if (sv) setCurrentUser(JSON.parse(sv)) } catch(e) {}
  }, [])

  useEffect(() => { if (id) loadClub() }, [id])

  async function loadClub() {
    const { data: c } = await supabase.from('clubs').select('*').eq('id', id).single()
    if (c) setClub(c)
    const { data: cm } = await supabase.from('club_members').select('*, member:members(*)').eq('club_id', id)
    if (cm) setMembers(cm.map(x => x.member).filter(Boolean))
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
    setShowAddBook(false); setNewBook({ title: '', author: '', chapters: '', noCh: false }); loadClub()
  }

  const isLiked = pid => currentUser && likes.some(l => l.post_id === pid && l.member_id === currentUser.id)
  const likeCount = pid => likes.filter(l => l.post_id === pid).length
  const parseThemes = str => (str || '').split(',').map(t => t.trim()).filter(Boolean)

  const openThread = t => { setActiveThread(t); setView('thread'); setReplyingTo(null); setExpandedReplies({}); loadThreadPosts(t.id) }
  const openProfile = m => { setProfileMember(m); setView('profile') }

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
          <BookSearch
            value={newBook.title ? { title: newBook.title, author: newBook.author } : null}
            onChange={(book) => setNewBook(d => ({
              ...d,
              title: book ? book.title : '',
              author: book ? book.author : '',
            }))}
            showChapters
            chaptersValue={newBook.chapters}
            onChaptersChange={(val) => setNewBook(d => ({ ...d, chapters: val }))}
            noChapters={newBook.noCh}
            onNoChaptersChange={(val) => setNewBook(d => ({ ...d, noCh: val }))}
            style={{ marginBottom: 24 }}
          />
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
            {currentUser && <div className="user-nav"><MemberAvatar member={currentUser} size={32} /><span className="user-nav-name">{currentUser.first_name}</span></div>}
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
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)', marginBottom: 32 }}>
          {[['feed', 'Feed'], ['disc', 'Bookshelf'], ['members', 'Members'], ['settings', 'Settings']].map(([k, l]) =>
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
          <h2 className="modal-title" style={{ fontSize: 24 }}>Club Settings</h2>
          <label className="field-label">Club Name</label><input className="field-input" defaultValue={club.name} />
          <label className="field-label">Description</label><input className="field-input" defaultValue={club.description} />
          <label className="field-label">Invite Link</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            <div style={{ flex: 1, padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txM)' }}>unscripted.club/join/{club.invite_code}</div>
            <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 8, padding: '12px 18px', cursor: 'pointer' }}>Copy</button>
          </div>
          <button className="modal-submit">Save Changes</button>
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
