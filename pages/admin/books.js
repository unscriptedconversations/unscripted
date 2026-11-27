// pages/admin/books.js
// Admin-only page for the one-time book cleanup (pages/api/backfill-books.js).
// Preview first, untick anything you disagree with, then Apply.
// The server re-checks who you are (ADMIN_EMAIL) and recomputes every change.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopNav from '../../components/TopNav'

const th = { textAlign: 'left', fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', padding: '10px 8px', borderBottom: '1px solid var(--bd2)' }
const td = { fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', padding: '10px 8px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' }
const btn = { fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--ink)', border: 'none', borderRadius: 10, padding: '12px 22px', cursor: 'pointer' }

export default function AdminBooks() {
  const [results, setResults] = useState(null)
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text }

  async function call(body) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg({ ok: false, text: 'Please log in first.' }); return null }
    const r = await fetch('/api/backfill-books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    let j = {}
    try { j = await r.json() } catch (e) {}
    if (!r.ok) { setMsg({ ok: false, text: (j.error || 'Something went wrong.') + (j.code ? ` (Error code: ${j.code})` : '') }); return null }
    return j
  }

  async function preview() {
    setBusy('preview'); setMsg(null)
    const j = await call({ mode: 'preview' })
    setBusy('')
    if (!j) return
    setResults(j.results || [])
    const p = {}
    for (const r of (j.results || [])) if (r.status === 'change') p[r.id] = true
    setPicked(p)
  }

  async function apply() {
    const ids = Object.keys(picked).filter(k => picked[k])
    if (!ids.length) return
    setBusy('apply'); setMsg(null)
    const j = await call({ mode: 'apply', ids })
    setBusy('')
    if (!j) return
    setMsg({ ok: !j.failed?.length, text: `Updated ${j.applied} ${j.applied === 1 ? 'book' : 'books'}.` + (j.failed?.length ? ` ${j.failed.length} failed. Preview again to retry.` : '') })
    setResults(null); setPicked({})
  }

  const changes = (results || []).filter(r => r.status === 'change')
  const others = (results || []).filter(r => r.status !== 'change')
  const nPicked = Object.values(picked).filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Book cleanup</div>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 24 }}>
          Links books saved before Open Library IDs were stored, and renames ones saved under their original-language title to the English edition. Nothing changes until you press Apply.
        </div>

        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={preview}>{busy === 'preview' ? 'Checking books…' : results ? 'Preview again' : 'Preview changes'}</button>
        {msg && <div role="status" style={{ fontFamily: 'var(--ui)', fontSize: 13, marginTop: 14, color: msg.ok ? 'var(--sg)' : '#A0603E' }}>{msg.text}</div>}

        {results && <>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', margin: '32px 0 8px' }}>Proposed changes ({changes.length})</div>
          {changes.length === 0 ? <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Nothing to change.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}></th><th style={th}>Club</th><th style={th}>Saved as</th><th style={th}>Change</th></tr></thead>
                <tbody>
                  {changes.map(r => (
                    <tr key={r.id}>
                      <td style={td}><input type="checkbox" aria-label={`Apply change to ${r.title}`} checked={!!picked[r.id]} onChange={e => setPicked(p => ({ ...p, [r.id]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--tc)' }} /></td>
                      <td style={td}>{r.club}</td>
                      <td style={td}><i>{r.title}</i><div style={{ fontSize: 11, color: 'var(--txD)' }}>{r.author}</div></td>
                      <td style={td}>
                        {r.new_title && <div>Rename to <i>{r.new_title}</i></div>}
                        {r.new_key && <div style={{ fontSize: 12, color: 'var(--txD)' }}>Link to Open Library {r.new_key}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {changes.length > 0 && <button style={{ ...btn, background: 'var(--tc)', marginTop: 16, opacity: busy || !nPicked ? 0.6 : 1 }} disabled={!!busy || !nPicked} onClick={apply}>{busy === 'apply' ? 'Applying…' : `Apply ${nPicked} ${nPicked === 1 ? 'change' : 'changes'}`}</button>}

          {others.length > 0 && <>
            <div style={{ fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--txD)', margin: '32px 0 8px' }}>No change ({others.length})</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Club</th><th style={th}>Book</th><th style={th}>Why</th></tr></thead>
                <tbody>
                  {others.map(r => (
                    <tr key={r.id}>
                      <td style={td}>{r.club}</td>
                      <td style={td}><i>{r.title}</i><div style={{ fontSize: 11, color: 'var(--txD)' }}>{r.author}</div></td>
                      <td style={{ ...td, color: r.status === 'skip' ? '#A0603E' : 'var(--txD)', fontSize: 12 }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>}
        </>}
      </div>
    </div>
  )
}
