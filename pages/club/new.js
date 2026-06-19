import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function NewClub() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [step, setStep] = useState(0)
  const [clubData, setCD] = useState({ name: '', desc: '', privacy: 'invite', bookTitle: '', bookAuthor: '', bookCh: '', noCh: false })
  const [bkQ, setBkQ] = useState('')
  const [bkR, setBkR] = useState([])
  const [bkL, setBkL] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdClub, setCreatedClub] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    try { const sv = window.localStorage?.getItem?.('unscripted_user'); if (sv) setCurrentUser(JSON.parse(sv)) } catch (e) {}
    setCheckedAuth(true)
  }, [])

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

  async function createClub() {
    if (!currentUser || !clubData.name.trim()) return
    setCreating(true)
    const { data: club } = await supabase.from('clubs').insert({
      name: clubData.name.trim(), description: clubData.desc.trim(), privacy: clubData.privacy, creator_id: currentUser.id,
    }).select().single()
    if (!club) { setCreating(false); return }
    await supabase.from('club_members').insert({ club_id: club.id, member_id: currentUser.id, role: 'host' })
    if (clubData.bookTitle) {
      const chapters = clubData.noCh ? 0 : parseInt(clubData.bookCh) || 0
      const book_key = (clubData.bookTitle + '|' + clubData.bookAuthor).toLowerCase().replace(/[^a-z0-9|]/g, '')
      const { data: book } = await supabase.from('books').insert({
        title: clubData.bookTitle, author: clubData.bookAuthor, total_chapters: chapters,
        current_chapter: 0, status: 'current', display_order: 1, club_id: club.id, book_key,
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
    setCreatedClub(club)
    setCreating(false)
  }

  const fl = { fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--txD)', marginBottom: 10, display: 'block' }
  const fi = { width: '100%', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', outline: 'none', marginBottom: 24 }
  const btn = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', width: '100%' }
  const btnO = { fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '13px 28px', cursor: 'pointer', width: '100%' }

  if (!checkedAuth) return null

  if (!currentUser) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <title>Start a club — unscripted</title>
      <div>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>You need an account to start a club.</div>
        <button style={btn} onClick={() => router.push('/signup')}>Join unscripted</button>
      </div>
    </div>
  )

  if (createdClub) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 24 }}><Logo /></div>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 32, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{createdClub.name} is live.</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', marginBottom: 28 }}>Share the invite link and start reading together.</div>
        <button style={btn} onClick={() => router.push(`/club/${createdClub.id}`)}>Go to your club</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <title>Start a club — unscripted</title>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {['Your club', 'First book', 'Launch'].map((l, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? 'var(--tc)' : 'var(--bd)', marginBottom: 8 }} />
              <span style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: i <= step ? 'var(--tc)' : 'var(--txD)' }}>{l}</span>
            </div>
          ))}
        </div>

        {step === 0 && <div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Name your club.</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 32 }}>Give it a name and a purpose. You set the tone.</div>
          <label style={fl}>Club Name</label><input style={fi} placeholder="What's it called?" value={clubData.name} onChange={e => setCD(d => ({ ...d, name: e.target.value }))} />
          <label style={fl}>Description</label><input style={fi} placeholder="One sentence — what's this club about?" value={clubData.desc} onChange={e => setCD(d => ({ ...d, desc: e.target.value }))} />
          <label style={fl}>Privacy</label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            {['invite', 'open'].map(p => (
              <div key={p} style={{ flex: 1, padding: '18px 20px', borderRadius: 12, border: clubData.privacy === p ? '2px solid var(--tc)' : '1.5px solid var(--bd)', background: clubData.privacy === p ? 'rgba(194,122,90,0.04)' : 'var(--sf)', cursor: 'pointer', textAlign: 'center' }} onClick={() => setCD(d => ({ ...d, privacy: p }))}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p === 'invite' ? 'Invite Only' : 'Open'}</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{p === 'invite' ? 'Members join via link' : 'Anyone can find & join'}</div>
              </div>
            ))}
          </div>
          <button style={{ ...btn, opacity: clubData.name.trim() ? 1 : 0.4 }} disabled={!clubData.name.trim()} onClick={() => setStep(1)}>Continue</button>
        </div>}

        {step === 1 && <div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>What's the first book?</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 24 }}>Search any published book or skip for now.</div>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <label style={fl}>Search for a book</label>
            <input style={{ ...fi, marginBottom: 0 }} placeholder="Start typing a title..." value={bkQ} onChange={e => searchBook(e.target.value)} />
            {(bkR.length > 0 || bkL) && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
              {bkL && <div style={{ padding: '16px 20px', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Searching...</div>}
              {bkR.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bd)' }} onClick={() => { setCD(d => ({ ...d, bookTitle: b.title, bookAuthor: b.author })); setBkQ(''); setBkR([]) }}>
                  {b.cover ? <img src={b.cover} style={{ width: 32, height: 44, borderRadius: 4, objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 20 }}>📖</span>}
                  <div><div style={{ fontFamily: 'var(--hd)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{b.title}</div><div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)' }}>{b.author}{b.year ? ` · ${b.year}` : ''}</div></div>
                </div>
              ))}
            </div>}
          </div>
          {clubData.bookTitle && <div style={{ background: 'var(--sf2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'var(--ink)' }}>{clubData.bookTitle}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--txD)', marginBottom: 12 }}>{clubData.bookAuthor}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', marginBottom: clubData.noCh ? 0 : 16 }}>
              <input type="checkbox" checked={clubData.noCh} onChange={e => setCD(d => ({ ...d, noCh: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--tc)' }} />No numbered chapters
            </label>
            {!clubData.noCh && <div style={{ marginTop: 16 }}><label style={fl}>How many chapters?</label><input style={{ ...fi, marginBottom: 0 }} type="number" placeholder="e.g. 12" value={clubData.bookCh} onChange={e => setCD(d => ({ ...d, bookCh: e.target.value }))} /></div>}
          </div>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnO} onClick={() => setStep(0)}>Back</button>
            <button style={{ ...btn, flex: 1 }} onClick={() => setStep(2)}>{clubData.bookTitle ? 'Continue' : 'Skip — add later'}</button>
          </div>
        </div>}

        {step === 2 && <div>
          <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Ready to launch.</div>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 32 }}>You can invite people once the club is live.</div>
          <div style={{ background: 'var(--sf2)', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
            <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{clubData.name}</div>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>{clubData.desc || 'No description yet'}</div>
            {clubData.bookTitle && <div style={{ fontFamily: 'var(--hd)', fontSize: 14, fontStyle: 'italic', color: 'var(--tc)', marginTop: 10 }}>Reading: {clubData.bookTitle}</div>}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnO} onClick={() => setStep(1)}>Back</button>
            <button style={{ ...btn, flex: 1, opacity: creating ? 0.6 : 1 }} disabled={creating} onClick={createClub}>{creating ? 'Launching...' : 'Launch club'}</button>
          </div>
        </div>}
      </div>
    </div>
  )
}
