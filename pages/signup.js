import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { FIGURES, getFigure } from '../lib/figures'
import Logo from '../components/Logo'
import BookSearch from '../components/BookSearch'

export default function Signup() {
  const router = useRouter()
  const [mode, setMode] = useState(null)
  const [step, setStep] = useState(0)
  const [sf, setSF] = useState(null)
  const [fc, setFC] = useState('All')
  const [joinedClubs, setJC] = useState({})
  const [clubs, setClubs] = useState([])
  const [regData, setRD] = useState({ first: '', last: '', email: '', password: '' })
  const [clubData, setCD] = useState({ name: '', desc: '', privacy: 'invite', bookTitle: '', bookAuthor: '', bookCh: '', noCh: false })
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [createdUser, setCreatedUser] = useState(null)
  const timer = useRef(null)

  async function loadClubs() {
    const { data } = await supabase.from('clubs').select('*, club_members(count), books(title, status)')
    if (data) setClubs(data)
  }

  async function createAccount() {
    setError('')
    if (!regData.first.trim() || !regData.last.trim() || !regData.email.trim()) {
      setError('All fields are required.'); return null
    }
    const initials = ((regData.first?.[0] || '') + (regData.last?.[0] || '')).toUpperCase()
    const fig = sf ? getFigure(sf) : FIGURES[0]
    const { data, error: err } = await supabase.from('members').insert({
      first_name: regData.first.trim(), last_name: regData.last.trim(),
      email: regData.email.trim().toLowerCase(), initials, color: fig.color, avatar_figure: sf || 'baldwin',
    }).select().single()
    if (err) {
      if (err.code === '23505') {
        const { data: ex } = await supabase.from('members').select('*').eq('email', regData.email.trim().toLowerCase()).single()
        if (ex) { setCreatedUser(ex); try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(ex)) } catch (e) {}; return ex }
      }
      setError(err.message); return null
    }
    setCreatedUser(data)
    try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch (e) {}
    return data
  }

  async function joinClub(clubId, memberId) {
    await supabase.from('club_members').insert({ club_id: clubId, member_id: memberId, role: 'member' })
  }

  async function createClub(memberId) {
    const { data: club } = await supabase.from('clubs').insert({
      name: clubData.name.trim(), description: clubData.desc.trim(), privacy: clubData.privacy, creator_id: memberId,
    }).select().single()
    if (!club) return
    await supabase.from('club_members').insert({ club_id: club.id, member_id: memberId, role: 'host' })
    if (clubData.bookTitle) {
      const chapters = clubData.noCh ? 0 : parseInt(clubData.bookCh) || 0
      const { data: book } = await supabase.from('books').insert({
        title: clubData.bookTitle, author: clubData.bookAuthor, total_chapters: chapters,
        current_chapter: 0, status: 'current', display_order: 1, club_id: club.id,
      }).select().single()
      if (book && chapters > 0) {
        const threadInserts = Array.from({ length: chapters }, (_, i) => ({
          book_id: book.id, chapter_number: i + 1, title: `Chapter ${i + 1}`, is_active: true,
        }))
        threadInserts.push({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${clubData.bookTitle}`, is_active: true })
        await supabase.from('threads').insert(threadInserts)
      } else if (book) {
        await supabase.from('threads').insert({ book_id: book.id, chapter_number: 0, title: `Open Discussion: ${clubData.bookTitle}`, is_active: true })
      }
    }
    return club
  }

  const filteredFigs = fc === 'All' ? FIGURES : FIGURES.filter(f => f.cat === fc)
  const chosenFig = sf ? FIGURES.find(f => f.id === sf) : null

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer', width: '100%' }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <title>Welcome to unscripted</title>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 28px' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        {chosenFig && <div style={{ width: 80, height: 80, borderRadius: '50%', background: chosenFig.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto 24px', border: '3px solid rgba(255,255,255,0.15)' }}>{chosenFig.icon}</div>}
        <div style={{ fontFamily: 'var(--hd)', fontSize: 36, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>You're in.</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)', lineHeight: 1.7, marginBottom: 32 }}>
          {mode === 'individual' ? 'Welcome to unscripted. The conversations are waiting.' : `${clubData.name || 'Your club'} is live. Share the invite link and start reading together.`}
        </div>
        <button style={btn} onClick={() => router.push('/')}>Explore unscripted</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Join unscripted</title>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>

        {/* MODE SELECT */}
        {!mode && <div style={{ paddingBottom: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 36, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>How do you want<br />to <em style={{ fontStyle: 'italic', color: 'var(--tc)' }}>read?</em></div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--txD)' }}>Join as a reader or start your own book club.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }} onClick={() => { setMode('individual'); setStep(0); loadClubs() }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tc)', marginBottom: 12 }}>Reader</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Join as an individual</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Create your profile, choose your avatar, and browse book clubs to join.</div>
            </div>
            <div style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 16, padding: '32px 28px', cursor: 'pointer' }} onClick={() => { setMode('club'); setStep(0) }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sg)', marginBottom: 12 }}>Host</div>
              <div style={{ fontFamily: 'var(--hd)', fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Start a book club</div>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6 }}>Create your club, set your first book, and invite your people.</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)' }}>Already have an account? </span>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}>Log in</span>
          </div>
        </div>}

        {/* INDIVIDUAL FLOW */}
        {mode === 'individual' && <div style={{ paddingBottom: 80 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
            {['About you', 'Your voice', 'Find clubs'].map((l, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? 'var(--tc)' : 'var(--bd)', marginBottom: 8 }} />
              <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: i <= step ? 'var(--tc)' : 'var(--txD)' }}>{l}</span>
            </div>)}
          </div>

          {step === 0 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Tell us about yourself.</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 32 }}>Just the basics.</div>
            {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', marginBottom: 16 }}>{error}</div>}
            <label style={fl}>First Name</label><input style={fi} placeholder="First name" value={regData.first} onChange={e => setRD(d => ({ ...d, first: e.target.value }))} />
            <label style={fl}>Last Name</label><input style={fi} placeholder="Last name" value={regData.last} onChange={e => setRD(d => ({ ...d, last: e.target.value }))} />
            <label style={fl}>Email</label><input style={fi} placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRD(d => ({ ...d, email: e.target.value }))} />
            <button style={btn} onClick={() => setStep(1)}>Continue</button>
          </div>}

          {step === 1 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Choose your voice.</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 24 }}>Pick a figure who speaks to how you move through the world.</div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)', marginBottom: 20 }}>
              {['All', 'Literature', 'Art', 'Culture'].map(c => <button key={c} style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: fc === c ? 'var(--ink)' : 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', position: 'relative' }} onClick={() => setFC(c)}>{c}{fc === c && <div style={{ position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, background: 'var(--tc)', borderRadius: 2 }} />}</button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24, maxHeight: 320, overflowY: 'auto' }}>
              {filteredFigs.map(f => <div key={f.id} style={{ background: sf === f.id ? 'rgba(194,122,90,0.04)' : 'var(--bg)', border: sf === f.id ? '2px solid var(--tc)' : '1.5px solid var(--bd)', borderRadius: 12, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} onClick={() => setSF(f.id)}>
                {sf === f.id && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--tc)' }} />}
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 8px' }}>{f.icon}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>{f.name}</div>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 11, fontStyle: 'italic', color: 'var(--txD)' }}>{f.sig}</div>
              </div>)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnO} onClick={() => setStep(0)}>Back</button>
              <button style={{ ...btn, flex: 1, opacity: sf ? 1 : 0.3 }} onClick={async () => { if (!sf) return; const user = await createAccount(); if (user) setStep(2) }}>Continue</button>
            </div>
          </div>}

          {step === 2 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Find your rooms.</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 32 }}>Browse clubs and join the ones that call to you.</div>
            {clubs.map(c => {
              const cb = (c.books || []).find(b => b.status === 'current')
              return <div key={c.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 14, padding: '20px 24px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{cb ? cb.title + ' · ' : ''}{c.club_members?.[0]?.count || 0} members</div>
                </div>
                <button style={{ fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: joinedClubs[c.id] ? 'var(--sg)' : 'var(--ink)', background: joinedClubs[c.id] ? 'rgba(94,122,98,0.1)' : 'none', border: joinedClubs[c.id] ? 'none' : '1.5px solid var(--bd2)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', minWidth: 80 }}
                  onClick={async () => {
                    if (!joinedClubs[c.id] && createdUser) { await joinClub(c.id, createdUser.id) }
                    setJC(p => ({ ...p, [c.id]: !p[c.id] }))
                  }}>{joinedClubs[c.id] ? 'Joined' : 'Join'}</button>
              </div>
            })}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button style={btnO} onClick={() => setStep(1)}>Back</button>
              <button style={{ ...btn, flex: 1 }} onClick={() => setDone(true)}>Enter unscripted</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}><span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }} onClick={() => setDone(true)}>Skip — I'll explore later</span></div>
          </div>}
        </div>}

        {/* BOOK CLUB FLOW */}
        {mode === 'club' && <div style={{ paddingBottom: 80 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
            {['About you', 'Your voice', 'Your club', 'First book', 'Invite'].map((l, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? 'var(--tc)' : 'var(--bd)', marginBottom: 8 }} />
              <span style={{ fontFamily: 'var(--ui)', fontSize: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: i <= step ? 'var(--tc)' : 'var(--txD)' }}>{l}</span>
            </div>)}
          </div>

          {step === 0 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>First, create your profile.</div>
            {error && <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: '#A0603E', marginBottom: 16 }}>{error}</div>}
            <label style={fl}>First Name</label><input style={fi} placeholder="First name" value={regData.first} onChange={e => setRD(d => ({ ...d, first: e.target.value }))} />
            <label style={fl}>Last Name</label><input style={fi} placeholder="Last name" value={regData.last} onChange={e => setRD(d => ({ ...d, last: e.target.value }))} />
            <label style={fl}>Email</label><input style={fi} placeholder="you@email.com" type="email" value={regData.email} onChange={e => setRD(d => ({ ...d, email: e.target.value }))} />
            <button style={btn} onClick={() => setStep(1)}>Continue</button>
          </div>}

          {step === 1 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 24 }}>Choose your voice.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24, maxHeight: 320, overflowY: 'auto' }}>
              {FIGURES.map(f => <div key={f.id} style={{ background: sf === f.id ? 'rgba(194,122,90,0.04)' : 'var(--bg)', border: sf === f.id ? '2px solid var(--tc)' : '1.5px solid var(--bd)', borderRadius: 12, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} onClick={() => setSF(f.id)}>
                {sf === f.id && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--tc)' }} />}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 6px' }}>{f.icon}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, color: 'var(--ink)' }}>{f.name}</div>
              </div>)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnO} onClick={() => setStep(0)}>Back</button>
              <button style={{ ...btn, flex: 1, opacity: sf ? 1 : 0.3 }} onClick={async () => { if (!sf) return; const user = await createAccount(); if (user) setStep(2) }}>Continue</button>
            </div>
          </div>}

          {step === 2 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>Name your club.</div>
            <label style={fl}>Club Name</label><input style={fi} placeholder="What's it called?" value={clubData.name} onChange={e => setCD(d => ({ ...d, name: e.target.value }))} />
            <label style={fl}>Description</label><input style={fi} placeholder="One sentence — what's this club about?" value={clubData.desc} onChange={e => setCD(d => ({ ...d, desc: e.target.value }))} />
            <label style={fl}>Privacy</label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              {['invite', 'open'].map(p => <div key={p} style={{ flex: 1, padding: '18px 20px', borderRadius: 12, border: clubData.privacy === p ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: clubData.privacy === p ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: 'pointer', textAlign: 'center' }} onClick={() => setCD(d => ({ ...d, privacy: p }))}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p === 'invite' ? 'Invite Only' : 'Open'}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{p === 'invite' ? 'Members join via link' : 'Anyone can find & join'}</div>
              </div>)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnO} onClick={() => setStep(1)}>Back</button>
              <button style={{ ...btn, flex: 1 }} onClick={() => setStep(3)}>Continue</button>
            </div>
          </div>}

          {step === 3 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 24 }}>What's the first book?</div>

            <BookSearch
              value={clubData.bookTitle ? { title: clubData.bookTitle, author: clubData.bookAuthor } : null}
              onChange={(book) => setCD(d => ({
                ...d,
                bookTitle: book ? book.title : '',
                bookAuthor: book ? book.author : '',
              }))}
              showChapters
              chaptersValue={clubData.bookCh}
              onChaptersChange={(val) => setCD(d => ({ ...d, bookCh: val }))}
              noChapters={clubData.noCh}
              onNoChaptersChange={(val) => setCD(d => ({ ...d, noCh: val }))}
              style={{ marginBottom: 24 }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnO} onClick={() => setStep(2)}>Back</button>
              <button style={{ ...btn, flex: 1 }} onClick={() => setStep(4)}>{clubData.bookTitle ? 'Continue' : 'Skip — add later'}</button>
            </div>
          </div>}

          {step === 4 && <div>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>Invite your people.</div>
            <label style={fl}>Shareable Link</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <div style={{ flex: 1, padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txM)' }}>unscripted.club/join/{(clubData.name || 'your-club').toLowerCase().replace(/\s+/g, '-')}</div>
              <button style={{ ...btnO, width: 'auto', padding: '12px 18px' }}>Copy</button>
            </div>
            <label style={fl}>Invite by Email</label>
            <input style={fi} placeholder="name@email.com, name@email.com" />
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnO} onClick={() => setStep(3)}>Back</button>
              <button style={{ ...btn, flex: 1 }} onClick={async () => { if (createdUser) await createClub(createdUser.id); setDone(true) }}>Launch club</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}><span style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', cursor: 'pointer' }} onClick={async () => { if (createdUser) await createClub(createdUser.id); setDone(true) }}>Skip — I'll invite later</span></div>
          </div>}
        </div>}

        {mode && !done && <div style={{ textAlign: 'center', paddingBottom: 48 }}>
          <button style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--txD)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setMode(null); setStep(0) }}>← Back to sign up options</button>
        </div>}
      </div>
    </div>
  )
}
