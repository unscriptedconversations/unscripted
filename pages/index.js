import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FIGURES, getFigure } from '../lib/figures'
import Logo from '../components/Logo'
import Tag from '../components/Tag'

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
  const fig = member.avatar_figure ? getFigure(member.avatar_figure) : null
  if (fig) return (
    <div className="fig-av" style={{ width: size, height: size, background: fig.color, fontSize: size * 0.5 }}>{fig.icon}</div>
  )
  return (
    <div className="fig-av" style={{ width: size, height: size, background: member.color || '#8B6E52', fontSize: size * 0.31, fontWeight: 700, fontFamily: 'var(--ui)' }}>{member.initials || '?'}</div>
  )
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
  const [discMode, setDiscMode] = useState('chapters')
  const [profileMember, setProfileMember] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [newPost, setNewPost] = useState('')
  const [showReg, setShowReg] = useState(false)
  const [regData, setRegData] = useState({ first: '', last: '', email: '' })
  const [regError, setRegError] = useState('')
  const [regStep, setRegStep] = useState(0)
  const [selFigure, setSelFigure] = useState(null)
  const [figCat, setFigCat] = useState('All')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ fav_book: '', fav_book_author: '', one_word: '', fav_cartoon: '' })
  const [vis, setVis] = useState(false)

  useEffect(() => {
    loadData()
    setTimeout(() => setVis(true), 60)
    try {
      const saved = window.localStorage?.getItem?.('unscripted_user')
      if (saved) setCurrentUser(JSON.parse(saved))
    } catch (e) {}
  }, [])

  async function loadData() {
    const [bR, mR, pR, tR, lR, rR] = await Promise.all([
      supabase.from('books').select('*').order('display_order'),
      supabase.from('members').select('*').order('created_at'),
      supabase.from('posts').select('*, member:members(*)').order('created_at', { ascending: false }),
      supabase.from('threads').select('*').order('chapter_number'),
      supabase.from('likes').select('*'),
      supabase.from('post_replies').select('post_id'),
    ])
    if (bR.data) { setBooks(bR.data); if (!selBook) setSelBook(bR.data[0]?.id) }
    if (mR.data) setMembers(mR.data)
    if (pR.data) setPosts(pR.data)
    if (tR.data) setThreads(tR.data)
    if (lR.data) setLikes(lR.data)
    if (rR.data) {
      const c = {}
      rR.data.forEach(r => { c[r.post_id] = (c[r.post_id] || 0) + 1 })
      setReplyCounts(c)
    }
  }

  async function handleRegister() {
    setRegError('')
    if (regStep === 0) {
      if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) { setRegError('All fields are required.'); return }
      setRegStep(1); return
    }
    if (!selFigure) { setRegError('Choose your voice.'); return }
    const initials = ((regData.first?.[0] || '') + (regData.last?.[0] || '')).toUpperCase()
    const fig = getFigure(selFigure)
    const { data, error } = await supabase.from('members').insert({
      first_name: regData.first.trim(), last_name: regData.last.trim(),
      email: regData.email.trim().toLowerCase(), initials, color: fig.color, avatar_figure: selFigure,
    }).select().single()
    if (error) {
      if (error.code === '23505') {
        const { data: ex } = await supabase.from('members').select('*').eq('email', regData.email.trim().toLowerCase()).single()
        if (ex) { setCurrentUser(ex); try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(ex)) } catch (e) {}; setShowReg(false); setRegStep(0); return }
      }
      setRegError(error.message); return
    }
    setCurrentUser(data); try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch (e) {}
    setShowReg(false); setRegStep(0); setRegData({ first: '', last: '', email: '' }); setSelFigure(null); loadData()
  }

  async function saveProfile() {
    if (!currentUser) return
    const { data } = await supabase.from('members').update({
      fav_book: profileForm.fav_book || null, fav_book_author: profileForm.fav_book_author || null,
      one_word: profileForm.one_word || null, fav_cartoon: profileForm.fav_cartoon || null,
    }).eq('id', currentUser.id).select().single()
    if (data) { setCurrentUser(data); try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch (e) {} }
    setShowEditProfile(false); loadData()
  }

  async function toggleLike(postId) {
    if (!currentUser) { setShowReg(true); return }
    const ex = likes.find(l => l.post_id === postId && l.member_id === currentUser.id)
    if (ex) await supabase.from('likes').delete().eq('id', ex.id)
    else await supabase.from('likes').insert({ post_id: postId, member_id: currentUser.id })
    loadData()
  }

  const isLiked = pid => currentUser && likes.some(l => l.post_id === pid && l.member_id === currentUser.id)
  const likeCount = pid => likes.filter(l => l.post_id === pid).length
  const goHome = () => { setView('home'); setProfileMember(null) }
  const goDisc = bid => { if (bid) setSelBook(bid); setDiscMode('chapters'); setView('disc') }
  const openProfile = m => { setProfileMember(m); setView('profile') }

  const curBook = books.find(b => b.status === 'current') || books[0]
  const activeBook = books.find(b => b.id === selBook) || curBook
  const curThreads = threads.filter(t => curBook && t.book_id === curBook.id && t.chapter_number > 0)
  const activeChapterThreads = threads.filter(t => activeBook && t.book_id === activeBook.id && t.chapter_number > 0)
  const activeOpenThread = threads.find(t => activeBook && t.book_id === activeBook.id && t.chapter_number === 0)
  const prog = curBook ? (curBook.current_chapter / curBook.total_chapters) * 100 : 0
  const filteredFigs = figCat === 'All' ? FIGURES : FIGURES.filter(f => f.cat === figCat)

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>unscripted</title>

      {/* REGISTER */}
      {showReg && (
        <div className="modal-overlay" onClick={() => { setShowReg(false); setRegStep(0) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: regStep === 1 ? 600 : 480 }}>
            <button className="modal-close" onClick={() => { setShowReg(false); setRegStep(0) }}>×</button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Logo /></div>
            {regStep === 0 && (<>
              <h2 className="modal-title">Pull up a chair.</h2>
              <p className="modal-sub">This isn't just a book club. It's a commitment to think deeper, listen harder, and show up. One mic. Every voice matters.</p>
              {regError && <p className="modal-err">{regError}</p>}
              <label className="field-label">First Name</label>
              <input className="field-input" placeholder="First name" value={regData.first} onChange={e => setRegData(d => ({ ...d, first: e.target.value }))} />
              <label className="field-label">Last Name</label>
              <input className="field-input" placeholder="Last name" value={regData.last} onChange={e => setRegData(d => ({ ...d, last: e.target.value }))} />
              <label className="field-label">Email</label>
              <input className="field-input" placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRegData(d => ({ ...d, email: e.target.value }))} />
              <button className="modal-submit" onClick={handleRegister}>Continue</button>
            </>)}
            {regStep === 1 && (<>
              <h2 className="modal-title" style={{ fontSize: 28 }}>Choose your voice.</h2>
              <p className="modal-sub">Pick the figure who speaks to how you move through the world.</p>
              {regError && <p className="modal-err">{regError}</p>}
              <div className="fig-tabs">{['All', 'Literature', 'Art', 'Culture'].map(c => (
                <button key={c} className={`fig-tab ${figCat === c ? 'act' : ''}`} onClick={() => setFigCat(c)}>{c}</button>
              ))}</div>
              <div className="fig-grid">{filteredFigs.map(f => (
                <div key={f.id} className={`fig-card ${selFigure === f.id ? 'selected' : ''}`} onClick={() => setSelFigure(f.id)}>
                  <div className="fig-av-lg" style={{ background: f.color }}>{f.icon}</div>
                  <div className="fig-name">{f.name}</div>
                  <div className="fig-sig">{f.sig}</div>
                </div>
              ))}</div>
              <button className="modal-submit" style={{ marginTop: 24 }} onClick={handleRegister}>Enter the room</button>
            </>)}
            <div className="step-dots">
              <div className={`step-dot ${regStep === 0 ? 'act' : ''}`} />
              <div className={`step-dot ${regStep === 1 ? 'act' : ''}`} />
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE */}
      {showEditProfile && currentUser && (
        <div className="modal-overlay" onClick={() => setShowEditProfile(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowEditProfile(false)}>×</button>
            <h2 className="modal-title" style={{ fontSize: 28 }}>Your profile</h2>
            <label className="field-label">Favorite Book</label>
            <input className="field-input" placeholder="Title" value={profileForm.fav_book} onChange={e => setProfileForm(d => ({ ...d, fav_book: e.target.value }))} />
            <label className="field-label">Author</label>
            <input className="field-input" placeholder="Author name" value={profileForm.fav_book_author} onChange={e => setProfileForm(d => ({ ...d, fav_book_author: e.target.value }))} />
            <label className="field-label">Describe yourself in one word</label>
            <input className="field-input" placeholder="One word" value={profileForm.one_word} onChange={e => setProfileForm(d => ({ ...d, one_word: e.target.value }))} />
            <label className="field-label">Favorite Cartoon Character</label>
            <input className="field-input" placeholder="Character name" value={profileForm.fav_cartoon} onChange={e => setProfileForm(d => ({ ...d, fav_cartoon: e.target.value }))} />
            <button className="modal-submit" onClick={saveProfile}>Save</button>
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
              <div className="user-nav" onClick={() => { setProfileForm({ fav_book: currentUser.fav_book || '', fav_book_author: currentUser.fav_book_author || '', one_word: currentUser.one_word || '', fav_cartoon: currentUser.fav_cartoon || '' }); setShowEditProfile(true) }}>
                <MemberAvatar member={currentUser} size={32} />
                <span className="user-nav-name">{currentUser.first_name}</span>
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
                <h1 className="hero-h1">Critical thinking.<br />Community. Literacy.<br /><em>Have an opinion.</em></h1>
                <p className="hero-p">A space built on the belief that the right book, read by the right people, at the right time — changes everything.</p>
              </div>
              <div>
                {curBook && (
                  <div className="book-card" onClick={() => goDisc(curBook.id)}>
                    <div className="book-card-inner">
                      <div className="book-label"><span className="book-dot" />Currently Reading</div>
                      <div className="book-title">{curBook.title}</div>
                      <div className="book-author">{curBook.author}</div>
                      <div className="progress-bg"><div className="progress-fill" style={{ width: `${prog}%` }} /></div>
                      <div className="progress-stats"><span>Ch. {curBook.current_chapter} of {curBook.total_chapters}</span><span>{Math.round(prog)}%</span></div>
                      <div className="book-readers">
                        <div style={{ display: 'flex' }}>{members.slice(0, 5).map((m, i) => (<div key={m.id} style={{ marginLeft: i ? -6 : 0 }}><MemberAvatar member={m} size={26} /></div>))}</div>
                        <span className="book-readers-label">{members.length} reading</span>
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
                      <MemberAvatar member={m} size={44} />
                      <div className="voice-meta">
                        <span className="voice-name">{m.first_name}</span>
                        <span className="voice-role">{m.role}</span>
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
                      <MemberAvatar member={currentUser} size={36} />
                      <textarea className="compose-input" placeholder="Say what's on your mind..." value={newPost} onChange={e => setNewPost(e.target.value)} rows={2} />
                    </div>
                    <div className="compose-foot">
                      <select className="tag-select" id="tag-select">
                        <option value="community">Community</option>
                        <option value="reflection">Reflection</option>
                        <option value="book">Book</option>
                      </select>
                      <button className="share-btn" disabled={!newPost.trim()} onClick={async () => {
                        const tag = document.getElementById('tag-select').value
                        if (!newPost.trim()) return
                        await supabase.from('posts').insert({ member_id: currentUser.id, content: newPost.trim(), tag })
                        setNewPost(''); loadData()
                      }}>Share</button>
                    </div>
                  </div>
                ) : (
                  <div className="compose compose-cta" onClick={() => setShowReg(true)}>
                    <p className="compose-placeholder">Join to share your thoughts...</p>
                  </div>
                )}
                {posts.map((p, i) => {
                  const m = p.member || {}
                  return (
                    <div key={p.id} className="feed-card" style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(10px)', transition: `all 0.5s ease ${0.5 + i * 0.07}s` }}>
                      <div className="feed-header">
                        <MemberAvatar member={m} size={32} />
                        <div><span className="feed-name" onClick={() => openProfile(m)}>{m.first_name}</span><span className="feed-time">{timeAgo(p.created_at)}</span></div>
                        <span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span>
                      </div>
                      <div className="feed-body">{p.content}</div>
                      <div className="feed-actions">
                        <button className={`feed-action ${isLiked(p.id) ? 'liked' : ''}`} onClick={() => toggleLike(p.id)}>{isLiked(p.id) ? '\u2665' : '\u2661'} {likeCount(p.id)}</button>
                        <span className="feed-action">{'\u21A9'} {replyCounts[p.id] || 0}</span>
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
                      <span className={`thread-num ${t.is_active ? 'hot' : ''}`}>Ch.{t.chapter_number}</span>
                      <span className="thread-title">{t.title}</span>
                      {t.is_active && <span className="active-dot" />}
                    </div>
                  ))}
                </div>
                {curBook && members.length > 0 && (
                  <div className="sidebar-section">
                    <div className="sidebar-label">Reading Pulse</div>
                    <div className="pulse-card">
                      <div className="pulse-book-title">{curBook.title}</div>
                      <div className="pulse-book-info">{curBook.total_chapters} chapters</div>
                      <div className="pulse-list">
                        {members.map(m => {
                          const jitter = Math.abs((m.id?.charCodeAt?.(0) || 0) % 30) - 15
                          const pct = Math.max(8, Math.min(100, prog + jitter))
                          return (
                            <div key={m.id} className="pulse-row">
                              <MemberAvatar member={m} size={24} />
                              <div className="pulse-bar-wrap">
                                <div className="pulse-bar-header">
                                  <span className="pulse-bar-name">{m.first_name}</span>
                                  <span className="pulse-bar-pct">{Math.round(pct)}%</span>
                                </div>
                                <div className="pulse-bar-bg"><div className="pulse-bar-fill" style={{ width: `${pct}%`, background: progressColor(pct) }} /></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="pulse-legend">
                        <span><span className="legend-dot" style={{ background: '#B0A594' }} />Starting</span>
                        <span><span className="legend-dot" style={{ background: '#C27A5A' }} />Moving</span>
                        <span><span className="legend-dot" style={{ background: '#7A9A7E' }} />Ahead</span>
                        <span><span className="legend-dot" style={{ background: '#5E7A62' }} />Caught up</span>
                      </div>
                    </div>
                  </div>
                )}
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
                <div key={b.id} className={`shelf-item ${selBook === b.id ? 'active' : ''}`} onClick={() => { setSelBook(b.id); setDiscMode('chapters') }}>
                  <div className={`shelf-title ${selBook === b.id ? 'inv' : ''}`}>{b.title}</div>
                  <div className={`shelf-author ${selBook === b.id ? 'inv' : ''}`}>{b.author}</div>
                  <span className="tag" style={{ background: b.status === 'current' ? (selBook === b.id ? 'rgba(194,122,90,0.25)' : 'var(--tcD)') : (selBook === b.id ? 'rgba(94,122,98,0.25)' : 'rgba(94,122,98,0.1)'), color: b.status === 'current' ? 'var(--tc)' : 'var(--sg)', width: 'fit-content', marginTop: 4 }}>
                    {b.status === 'current' ? 'Reading Now' : 'Completed'}
                  </span>
                </div>
              ))}
            </div>

            {activeBook && (<>
              <div className="disc-header">
                <div className="disc-title">{activeBook.title}</div>
                {activeBook.status === 'current' && <div className="disc-active"><span className="active-dot" />Active</div>}
              </div>
              <div className="disc-meta">by {activeBook.author} · {activeChapterThreads.length} chapter threads{activeOpenThread ? ' · Open discussion available' : ''}</div>

              {activeBook.status === 'completed' && activeOpenThread && (
                <div className="mode-toggle">
                  <button className={`mode-btn ${discMode === 'chapters' ? 'act' : ''}`} onClick={() => setDiscMode('chapters')}>By Chapter</button>
                  <button className={`mode-btn ${discMode === 'open' ? 'act' : ''}`} onClick={() => setDiscMode('open')}>Open Discussion</button>
                </div>
              )}

              {(discMode === 'chapters' || activeBook.status === 'current') && (
                <div>
                  {activeChapterThreads.map(t => (
                    <div className="thread-card-lg" key={t.id}>
                      <div className={`thread-badge ${t.is_active ? 'hot' : ''}`}>{t.chapter_number}</div>
                      <div className="thread-info">
                        <div className="thread-info-title">{t.title}</div>
                        <div className="thread-info-meta">{t.is_active ? 'Active' : 'Completed'}</div>
                      </div>
                      {t.is_active && <span className="active-dot" />}
                    </div>
                  ))}
                  {activeBook.status === 'current' && Array.from({ length: activeBook.total_chapters - activeChapterThreads.length }, (_, i) => (
                    <div className="thread-card-lg faded" key={`f${i}`}>
                      <div className="thread-badge">{activeChapterThreads.length + i + 1}</div>
                      <div className="thread-info">
                        <div className="thread-info-title faded-text">Coming Soon</div>
                        <div className="thread-info-meta">Opens with reading schedule</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {discMode === 'open' && activeBook.status === 'completed' && activeOpenThread && (
                <div>
                  <div className="open-card">
                    <div className="open-card-row">
                      <div className="open-icon">💬</div>
                      <div className="open-info">
                        <div className="open-title">{activeOpenThread.title}</div>
                        <div className="open-meta">All chapters · No spoiler walls</div>
                      </div>
                      <div className="open-enter">Enter</div>
                    </div>
                    <div className="open-desc">The full conversation — no chapter boundaries. Talk about the book as a whole, connect themes across sections, share how it changed your thinking. Spoilers welcome.</div>
                  </div>
                  <div className="section-title" style={{ marginTop: 32, marginBottom: 16 }}>Or dive into a specific chapter</div>
                  {activeChapterThreads.map(t => (
                    <div className="thread-card-sm" key={t.id}>
                      <div className="thread-badge-sm">{t.chapter_number}</div>
                      <div className="thread-info">
                        <div className="thread-info-title">{t.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && profileMember && (
          <div style={{ paddingBottom: 80 }}>
            <button className="profile-back" onClick={goHome}>← Back</button>
            <div className="profile-header">
              <MemberAvatar member={profileMember} size={88} />
              <div>
                <div className="profile-name">{profileMember.first_name} {profileMember.last_name}</div>
                <div className="profile-role">{profileMember.role}</div>
                {profileMember.avatar_figure && <div className="profile-figure">{getFigure(profileMember.avatar_figure).name}</div>}
              </div>
            </div>

            {(profileMember.fav_book || profileMember.one_word || profileMember.fav_cartoon) ? (
              <div className="bio-grid">
                <div className="bio-card"><div className="bio-accent" style={{ background: 'var(--tc)' }} /><div className="bio-label">Favorite Book</div>
                  {profileMember.fav_book ? (<><div className="bio-book-title">{profileMember.fav_book}</div><div className="bio-book-author">{profileMember.fav_book_author}</div></>) : <div className="bio-empty">Not shared yet</div>}
                </div>
                <div className="bio-card"><div className="bio-accent" style={{ background: 'var(--sg)' }} /><div className="bio-label">In one word</div>
                  {profileMember.one_word ? <div className="bio-word">{profileMember.one_word}</div> : <div className="bio-empty">Not shared yet</div>}
                </div>
                <div className="bio-card"><div className="bio-accent" style={{ background: '#6B6590' }} /><div className="bio-label">Favorite Cartoon Character</div>
                  {profileMember.fav_cartoon ? <div className="bio-cartoon">{profileMember.fav_cartoon}</div> : <div className="bio-empty">Not shared yet</div>}
                </div>
              </div>
            ) : (
              <div className="bio-empty-state">
                <div className="bio-empty-title">{profileMember.first_name} hasn't filled out their profile yet</div>
                <div className="bio-empty-sub">When they do, you'll see their favorite book, a word that defines them, and their favorite cartoon character.</div>
              </div>
            )}

            <div className="section-title" style={{ marginBottom: 20 }}>Posts by {profileMember.first_name}</div>
            {posts.filter(p => p.member_id === profileMember.id).map(p => (
              <div key={p.id} className="feed-card">
                <div className="feed-header">
                  <MemberAvatar member={profileMember} size={32} />
                  <div><span className="feed-name">{profileMember.first_name}</span><span className="feed-time">{timeAgo(p.created_at)}</span></div>
                  <span style={{ marginLeft: 'auto' }}><Tag tag={p.tag} /></span>
                </div>
                <div className="feed-body">{p.content}</div>
              </div>
            ))}
            {posts.filter(p => p.member_id === profileMember.id).length === 0 && (
              <div className="profile-no-posts">{profileMember.first_name} hasn't posted yet — but they're reading.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
