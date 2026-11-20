import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// Cog button for the top nav. Opens a small menu: Settings (your profile's
// Account tab), Send feedback (saved to beta_feedback; read it in Supabase's
// Table Editor), and Log out. Closes on outside click, Escape, or choosing an item.
// Built to drop into any page's nav (and a future shared TopNav).
//
// Props:
//   currentUser : the logged-in member (needs .id)
//   onLogout    : optional; called after sign-out so the page can clear its state

export default function SettingsMenu({ currentUser, onLogout }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fbOpen, setFbOpen] = useState(false)
  const [fbText, setFbText] = useState('')
  const [fbState, setFbState] = useState('idle') // idle | sending | sent | error
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('touchstart', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  async function logOut() {
    setOpen(false)
    try { await supabase.auth.signOut({ scope: 'local' }) } catch (e) {}
    onLogout?.()
  }

  function settings() {
    setOpen(false)
    if (currentUser?.id) router.push(`/profile/${currentUser.id}?tab=account`)
  }

  function openFeedback() { setOpen(false); setFbText(''); setFbState('idle'); setFbOpen(true) }
  function closeFeedback() { if (fbState !== 'sending') setFbOpen(false) }
  async function sendFeedback() {
    const msg = fbText.trim()
    if (msg.length < 2 || !currentUser?.id) return
    setFbState('sending')
    const { error } = await supabase.from('beta_feedback').insert({
      member_id: currentUser.id,
      message: msg.slice(0, 4000),
      page: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    })
    setFbState(error ? 'error' : 'sent')
  }

  const item = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '11px 16px', fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Settings menu"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: open ? 'var(--sf)' : 'none', border: '1px solid ' + (open ? 'var(--bd2)' : 'transparent'), color: 'var(--txD)', cursor: 'pointer', padding: 0, transition: 'background 0.15s, border-color 0.15s' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 168, zIndex: 50, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', overflow: 'hidden', padding: '4px 0' }}>
          <button type="button" role="menuitem" style={item} onClick={settings}>Settings</button>
          <button type="button" role="menuitem" style={item} onClick={openFeedback}>Send feedback</button>
          <div style={{ height: 1, background: 'var(--bd)', margin: '4px 0' }} />
          <button type="button" role="menuitem" style={{ ...item, color: 'var(--txD)' }} onClick={logOut}>Log out</button>
        </div>
      )}

      {fbOpen && (
        <div onClick={closeFeedback} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Send feedback" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 18, padding: '28px 26px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', cursor: 'default' }}>
            {fbState === 'sent' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Thank you</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 20 }}>Every note helps shape unscripted during the beta.</div>
                <button type="button" onClick={() => setFbOpen(false)} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--tc)', border: 'none', borderRadius: 10, padding: '12px 22px', cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Send feedback</div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', lineHeight: 1.6, marginBottom: 16 }}>Something broken, confusing, or delightful? Tell us. We read every note.</div>
                <textarea value={fbText} onChange={e => setFbText(e.target.value)} rows={5} maxLength={4000} autoFocus
                  placeholder="What happened, and what did you expect?"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 10, fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', resize: 'vertical', outline: 'none' }} />
                {fbState === 'error' && <div style={{ fontFamily: 'var(--ui)', fontSize: 12, color: '#A0603E', marginTop: 8 }}>Sorry, that didn{'\u2019'}t send. Please try again.</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" onClick={closeFeedback} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)', background: 'none', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '11px 18px', cursor: 'pointer' }}>Cancel</button>
                  <button type="button" onClick={sendFeedback} disabled={fbState === 'sending' || fbText.trim().length < 2}
                    style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFF', background: 'var(--tc)', border: 'none', borderRadius: 10, padding: '11px 20px', cursor: 'pointer', opacity: (fbState === 'sending' || fbText.trim().length < 2) ? 0.5 : 1 }}>
                    {fbState === 'sending' ? 'Sending\u2026' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
