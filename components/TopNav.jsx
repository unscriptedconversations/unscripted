import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BRIDGE_ENABLED } from '../lib/flags'
import Logo from './Logo'
import NotificationBell from './NotificationBell'
import SettingsMenu from './SettingsMenu'

// Shared top navigation. Handles its own sign-in state, so a page just drops
// in <TopNav />. Loads instantly with no "Log in" flash for members:
//   1. decide from this browser's saved login (no network)
//   2. confirm with Supabase and refresh the cached member
//   3. follow sign-in / sign-out events
//
// Props:
//   active   : 'explore' to highlight Explore (homepage)
//   children : extra nav buttons shown after Explore (e.g. the club's name)
//   onUser   : optional; called with the member (or null) whenever it changes

const CACHE_KEY = 'unscripted_user'

function savedUid() {
  try {
    const key = Object.keys(window.localStorage).find(k => /^sb-.*-auth-token$/.test(k))
    return key ? JSON.parse(window.localStorage.getItem(key) || 'null')?.user?.id || null : null
  } catch (e) { return null }
}
function readCache() {
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null') } catch (e) { return null }
}
function writeCache(m) {
  try { m ? window.localStorage.setItem(CACHE_KEY, JSON.stringify(m)) : window.localStorage.removeItem(CACHE_KEY) } catch (e) {}
}

export default function TopNav({ active, children, onUser }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  function apply(m) { setUser(m); onUser?.(m) }

  useEffect(() => {
    let live = true

    // 1. Fast path from browser storage
    const uid = savedUid()
    if (!uid) setReady(true)
    else {
      const cached = readCache()
      if (cached?.id === uid) { apply(cached); setReady(true) }
    }

    // 2. Confirm with Supabase
    async function load(session) {
      if (!session) { if (live) { apply(null); writeCache(null) } return }
      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).maybeSingle()
      if (!live) return
      if (m) { apply(m); writeCache(m) }
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => load(session))
      .catch(() => {})
      .finally(() => { if (live) setReady(true) })

    // 3. Follow sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { apply(null); writeCache(null); return }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') load(session)
    })

    return () => { live = false; subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <nav className="topnav">
      <div className="brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
      <div className="nav-links">
        <button className={`nav-btn ${active === 'explore' ? 'active' : ''}`} onClick={() => { if (active !== 'explore') router.push('/') }}>Explore</button>
        {BRIDGE_ENABLED && <button className="nav-btn" onClick={() => router.push('/bridge')}>Bridge</button>}
        {children}
        {!ready ? (
          <div aria-hidden="true" style={{ minWidth: 120 }} />
        ) : user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationBell currentUser={user} />
            <div className="user-nav" onClick={() => router.push(`/profile/${user.id}`)}>
              <span className="user-nav-name">{user.first_name}</span>
            </div>
            <SettingsMenu currentUser={user} onLogout={() => { apply(null); writeCache(null) }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}
              onClick={() => router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`)}>Log in</span>
            <button className="join-btn" onClick={() => router.push('/signup')}>Join</button>
          </div>
        )}
      </div>
    </nav>
  )
}
