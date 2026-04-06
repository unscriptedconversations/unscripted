import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import Tag from '../components/Tag'

const AVATAR_COLORS = ['#8B6E52','#5E7A62','#6B6590','#8B5E5E','#52708B','#8B7E52','#7A5278','#5E8B7A','#8B5275','#6E8B52']

function getInitials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase()
}

function getColor(id) {
  let hash = 0
  for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

export default function Home() {
  const [view, setView] = useState('home')
  const [books, setBooks] = useState([])
  const [threads, setThreads] = useState([])
  const [members, setMembers] = useState([])
  const [posts, setPosts] = useState([])
  const [likes, setLikes] = useState([])
  const [replyCounts, setReplyCounts] = useState({})
  const [selBook, setSelBook] = useState(null)
  const [profileMember, setProfileMember] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [newPost, setNewPost] = useState('')
  const [showReg, setShowReg] = useState(false)
  const [regData, setRegData] = useState({ first: '', last: '', email: '' })
  const [regError, setRegError] = useState('')
  const [vis, setVis] = useState(false)

  // Load data
  useEffect(() => {
    loadData()
    setTimeout(() => setVis(true), 60)
    // Check if user is stored in localStorage
    try {
      const saved = window.localStorage?.getItem?.('unscripted_user')
      if (saved) setCurrentUser(JSON.parse(saved))
    } catch(e) {}
  }, [])

  async function loadData() {
    const [booksRes, membersRes, postsRes, threadsRes, likesRes, repliesRes] = await Promise.all([
      supabase.from('books').select('*').order('display_order'),
      supabase.from('members').select('*').order('created_at'),
      supabase.from('posts').select('*, member:members(*)').order('created_at', { ascending: false }),
      supabase.from('threads').select('*').order('chapter_number'),
      supabase.from('likes').select('*'),
      supabase.from('post_replies').select('post_id'),
    ])
    if (booksRes.data) { setBooks(booksRes.data); setSelBook(booksRes.data[0]?.id) }
    if (membersRes.data) setMembers(membersRes.data)
    if (postsRes.data) setPosts(postsRes.data)
    if (threadsRes.data) setThreads(threadsRes.data)
    if (likesRes.data) setLikes(likesRes.data)
    if (repliesRes.data) {
      const counts = {}
      repliesRes.data.forEach(r => { counts[r.post_id] = (counts[r.post_id] || 0) + 1 })
      setReplyCounts(counts)
    }
  }

  // Auth
  async function handleRegister() {
    setRegError('')
    if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) {
      setRegError('All fields are required.')
      return
    }
    const initials = getInitials(regData.first, regData.last)
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    const { data, error } = await supabase.from('members').insert({
      first_name: regData.first.trim(),
      last_name: regData.last.trim(),
      email: regData.email.trim().toLowerCase(),
      initials,
      color,
    }).select().single()
    if (error) {
      if (error.code === '23505') {
        // Email exists — log them in
        const { data: existing } = await supabase.from('members').select('*').eq('email', regData.email.trim().toLowerCase()).single()
        if (existing) {
          setCurrentUser(existing)
          try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(existing)) } catch(e) {}
          setShowReg(false)
          return
        }
      }
      setRegError(error.message)
      return
    }
    setCurrentUser(data)
    try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch(e) {}
    setShowReg(false)
    setRegData({ first: '', last: '', email: '' })
    loadData()
  }

  // Post
  async function submitPost() {
    if (!newPost.trim() || !currentUser) return
    await supabase.from('posts').insert({
      member_id: currentUser.id,
      content: newPost.trim(),
      tag: 'community',
    })
    setNewPost('')
    loadData()
  }

  // Like
  async function toggleLike(postId) {
    if (!currentUser) { setShowReg(true); return }
    const existing = likes.find(l => l.post_id === postId && l.member_id === currentUser.id)
    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id)
    } else {
      await supabase.from('likes').insert({ post_id: postId, member_id: currentUser.id })
    }
    loadData()
  }

  function isLiked(postId) {
    return currentUser && likes.some(l => l.post_id === postId && l.member_id === currentUser.id)
  }

  function likeCount(postId) {
    return likes.filter(l => l.post_id === postId).length
  }

  // Navigation
  const goHome = () => { setView('home'); setProfileMember(null) }
  const goDisc = (bookId) => { if (bookId) setSelBook(bookId); setView('disc') }
  const openProfile = (m) => { setProfileMember(m); setView('profile') }

  const curBook = books.find(b => b.status === 'current') || books[0]
  const activeBook = books.find(b => b.id === selBook) || curBook
  const curThreads = threads.filter(t => curBook && t.book_id === curBook.id)
  const activeThreads = threads.filter(t => activeBook && t.book_id === activeBook.id)
  const prog = curBook ? (curBook.current_chapter / curBook.total_chapters) * 100 : 0

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>unscripted — book club</title>

      {/* REGISTER MODAL */}
      {showReg && (
        <div className="modal-overlay" onClick={() => setShowReg(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowReg(false)}>×</button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Logo /></div>
            <h2 style={{ fontFamily: 'var(--hd)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Pull up a chair.</h2>
            <p style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 32 }}>
              This isn't just a book club. It's a commitment to think deeper, listen harder, and show up — for yourself and for each other. One mic. Every voice matters.
            </p>
            {regError && <p style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', marginBottom: 16 }}>{regError}</p>}
            <label className="field-label">First Name</label>
            <input className="field-input" placeholder="First name" value={regData.first} onChange={e => setRegData(d => ({ ...d, first: e.target.value }))} />
            <label className="field-label">Last Name</label>
            <input className="field-input" placeholder="Last name" value={regData.last} onChange={e => setRegData(d => ({ ...d, last: e.target.value }))} />
            <label className="field-label">Email</label>
            <input className="field-input" placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRegData(d => ({ ...d, email: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
            <button className="modal-submit" onClick={handleRegister}>Enter the room</button>
          </div>
        </div>
      )}

      <div className="shell">
        {/* NAV */}
        <nav className="topnav">
          <div className="brand" onClick={goHome}><Logo /></div>
          <div className="nav-links">
            <button className={`nav-btn ${view === 'home' ? 'active' : ''}`} onClick={goHome}>Home</button>
            <button className={`nav-btn ${view === 'disc' ? 'active' : ''}`} onClick={() => goDisc(null)}>Discussions</button>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar member={{ initials: currentUser.initials, color: currentUser.color }} size={32} />
                <span style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{currentUser.first_name}</span>
              </div>
            ) : (
              <button className="join-btn" onClick={() => setShowReg(true)}>Join</button>
            )}
          </div>
        </nav>

        {/* HOME */}
        {view === 'home' && (
          <div style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.7s cubic-bezier(0.22,1,0.36,1)' }}>
            <section className="hero">
              <div>
                <div className="eyebrow">Year One</div>
                <h1 className="hero-h1">One mic.<br />Every voice <em>matters.</em></h1>
                <p className="hero-p">A space built on the belief that the right book, read by the right people, at the right time — changes everything. Intelligence. Critical thinking. Community. Literacy. It starts here.</p>
              </div>
              <div>
                {curBook && (
                  <div className="book-card" onClick={() => goDisc(curBook.id)}>
                    <div className="book-card-inner">
                      <div className="book-label"><span className="book-dot" />Currently Reading</div>
                      <div className="book-title">{curBook.title}</div>
                      <div className="book-author">{curBook.author}</div>
                      <div className="progress-bg"><div className="progress-fill" style={{ width: `${prog}%` }} /></div>
                      <div className="progress-stats"><span>Chapter {curBook.current_chapter} of {curBook.total_chapters}</span><span>{Math.round(prog)}%</span></div>
                      <div className="book-readers">
                        <div style={{ display: 'flex' }}>
                          {members.slice(0, 5).map(m => (
                            <div key={m.id} style={{ marginLeft: m === members[0] ? 0 : -6 }}>
                              <Avatar member={{ initials: m.initials, color: m.color }} size={26} />
                            </div>
                          ))}
                        </div>
                        <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 6, flex: 1 }}>{members.length} reading</span>
                        <span className="book-cta">Join discussion →</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* VOICES */}
            {members.length > 0 && (
              <section style={{ paddingBottom: 48 }}>
                <div className="section-header"><div className="section-title">The Voices at the Table</div></div>
                <div className="voices-scroll">
                  {members.map((m, i) => (
                    <div key={m.id} className="voice-card" onClick={() => openProfile(m)} style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(12px)', transition: `all 0.5s ease ${0.3 + i * 0.07}s` }}>
                      <Avatar member={{ initials: m.initials, color: m.color }} size={40} />
                      {m.quote && <div style={{ fontFamily: 'var(--hd)', fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--txM)', margin: '16px 0' }}>"{m.quote}"</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{m.first_name}</span>
                        <span style={{ fontFamily: 'var(--ui)', fontSize: 10, color: 'var(--txD)' }}>{m.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FEED + SIDEBAR */}
            <div className="main-grid">
              <div>
                <div className="section-header" style={{ marginBottom: 20 }}><div className="section-title">The Feed</div></div>
                {currentUser ? (
                  <div className="compose">
                    <div className="compose-row">
                      <Avatar member={{ initials: currentUser.initials, color: currentUser.color }} size={36} />
                      <textarea className="compose-input" placeholder="Say what's on your mind..." value={newPost} onChange={e => setNewPost(e.target.value)} rows={2} />
                    </div>
                    <div className="compose-foot">
                      <select style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', marginRight: 12, background: 'var(--bg)', outline: 'none' }} id="tag-select">
                        <option value="community">Community</option>
                        <option value="reflection">Reflection</option>
                        <option value="book">Book</option>
                      </select>
                      <button className="share-btn" disabled={!newPost.trim()} onClick={async () => {
                        const tag = document.getElementById('tag-select').value
                        if (!newPost.trim()) return
                        await supabase.from('posts').insert({ member_id: currentUser.id, content: newPost.trim(), tag })
                        setNewPost('')
                        loadData()
                      }}>Share</button>
                    </div>
                  </div>
                ) : (
                  <div className="compose" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowReg(true)}>
                    <p style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', color: 'var(--txD)', padding: '12px 0' }}>Join to share your thoughts...</p>
                  </div>
                )}
                {posts.map((p, i) => {
                  const member = p.member || {}
                  return (
                    <div key={p.id} className="feed-card" style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(10px)', transition: `all 0.5s ease ${0.5 + i * 0.07}s` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <Avatar member={{ initials: member.initials, color: member.color }} size={32} />
                        <div>
                          <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => openProfile(member)}>{member.first_name}</span>
                          <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 10 }}>{timeAgo(p.created_at)}</span>
                        </div>
                        <span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span>
                      </div>
                      <div style={{ fontFamily: 'var(--hd)', fontSize: 16.5, lineHeight: 1.75, color: 'var(--txM)', marginBottom: 18 }}>{p.content}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: isLiked(p.id) ? 'var(--tc)' : 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => toggleLike(p.id)}>
                          {isLiked(p.id) ? '♥' : '♡'} {likeCount(p.id)}
                        </button>
                        <span style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--txD)' }}>↩ {replyCounts[p.id] || 0}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="sidebar">
                <div className="sidebar-section">
                  <div className="sidebar-label">Chapter Threads</div>
                  {curThreads.map(t => (
                    <div className="thread-card" key={t.id} onClick={() => goDisc(curBook?.id)}>
                      <span style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, color: t.is_active ? 'var(--tc)' : 'var(--txD)', width: 28, textAlign: 'center', flexShrink: 0 }}>Ch.{t.chapter_number}</span>
                      <span style={{ fontFamily: 'var(--hd)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      {t.is_active && <span className="active-dot" />}
                    </div>
                  ))}
                </div>
                <div className="sidebar-section">
                  <div className="sidebar-label">The Creed</div>
                  <div className="creed-card">
                    <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', lineHeight: 1.7, color: 'rgba(242,235,224,0.65)', position: 'relative', marginBottom: 14 }}>
                      "Goodness, mercy, love, understanding — cultivated through the shared act of reading and the courage to think together."
                    </div>
                    <div style={{ fontFamily: 'var(--cs)', fontSize: 16, color: 'var(--tc)', fontWeight: 600, position: 'relative' }}>unscripted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DISCUSSIONS */}
        {view === 'disc' && (
          <div style={{ padding: '40px 0 80px', opacity: vis ? 1 : 0, transition: 'opacity 0.5s' }}>
            <div className="section-title" style={{ marginBottom: 20 }}>The Bookshelf</div>
            <div className="shelf">
              {books.map(b => (
                <div key={b.id} className={`shelf-item ${selBook === b.id ? 'active' : ''}`} onClick={() => setSelBook(b.id)}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, fontStyle: 'italic', color: selBook === b.id ? '#F2EBE0' : 'var(--ink)', lineHeight: 1.2, transition: 'color 0.25s' }}>{b.title}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 10, color: selBook === b.id ? 'rgba(242,235,224,0.45)' : 'var(--txD)', transition: 'color 0.25s' }}>{b.author}</div>
                  <span className="tag" style={{ background: b.status === 'current' ? (selBook === b.id ? 'rgba(194,122,90,0.25)' : 'var(--tcD)') : (selBook === b.id ? 'rgba(94,122,98,0.25)' : 'rgba(94,122,98,0.1)'), color: b.status === 'current' ? 'var(--tc)' : 'var(--sg)', width: 'fit-content', marginTop: 4 }}>
                    {b.status === 'current' ? 'Reading Now' : 'Completed'}
                  </span>
                </div>
              ))}
            </div>
            {activeBook && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{activeBook.title}</div>
                  {activeBook.status === 'current' && <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--tc)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}><span className="active-dot" />Active</div>}
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginBottom: 32 }}>by {activeBook.author} · {activeThreads.length} threads</div>
                {activeThreads.map(t => (
                  <div className="thread-card" key={t.id} style={{ marginBottom: 12, padding: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: t.is_active ? 'var(--tcD)' : 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 700, color: t.is_active ? 'var(--tc)' : 'var(--txD)', flexShrink: 0 }}>{t.chapter_number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--hd)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{t.title}</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{t.is_active ? 'Active' : 'Completed'}</div>
                    </div>
                    {t.is_active && <span className="active-dot" />}
                  </div>
                ))}
                {activeBook.status === 'current' && Array.from({ length: activeBook.total_chapters - activeThreads.length }, (_, i) => (
                  <div className="thread-card" key={`f${i}`} style={{ marginBottom: 12, padding: 20, opacity: 0.35 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 700, color: 'var(--txD)', flexShrink: 0 }}>{activeThreads.length + i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--hd)', fontSize: 17, fontWeight: 600, color: 'var(--txD)' }}>Coming Soon</div>
                      <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>Opens with reading schedule</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && profileMember && (
          <div style={{ paddingBottom: 80 }}>
            <button className="profile-back" onClick={goHome}>← Back</button>
            <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap' }}>
              <Avatar member={{ initials: profileMember.initials, color: profileMember.color }} size={80} />
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 38, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{profileMember.first_name} {profileMember.last_name}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 16 }}>{profileMember.role} · Since {new Date(profileMember.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                {profileMember.quote && <div style={{ fontFamily: 'var(--hd)', fontSize: 17, fontStyle: 'italic', color: 'var(--txD)', lineHeight: 1.65, maxWidth: 480 }}>"{profileMember.quote}"</div>}
              </div>
            </div>
            <div className="section-title" style={{ marginBottom: 20 }}>Posts by {profileMember.first_name}</div>
            {posts.filter(p => p.member_id === profileMember.id).map(p => (
              <div key={p.id} className="feed-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Avatar member={{ initials: profileMember.initials, color: profileMember.color }} size={32} />
                  <div>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{profileMember.first_name}</span>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginLeft: 10 }}>{timeAgo(p.created_at)}</span>
                  </div>
                  <span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span>
                </div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 16.5, lineHeight: 1.75, color: 'var(--txM)' }}>{p.content}</div>
              </div>
            ))}
            {posts.filter(p => p.member_id === profileMember.id).length === 0 && (
              <div style={{ fontFamily: 'var(--hd)', fontSize: 16, fontStyle: 'italic', color: 'var(--txD)', padding: '32px 0' }}>
                {profileMember.first_name} hasn't posted yet — but they're reading.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
