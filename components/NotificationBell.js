import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

const VERB = {
  mention: 'mentioned you',
  follow: 'started following you',
  reply: 'replied to you',
  club_post: 'posted',
}
function clubPostText(n) {
  const c = n.count || 1
  return `${c} new post${c === 1 ? '' : 's'} in ${n.preview || 'your club'}`
}

export default function NotificationBell({ currentUser }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!currentUser) return
    fetchItems()
    const t = setInterval(fetchItems, 45000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:members(first_name, last_name, initials, color)')
      .eq('recipient_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems(data || [])
  }

  const unread = items.filter(i => !i.is_read).length

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setItems(items.map(i => ({ ...i, is_read: true })))
      await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', currentUser.id).eq('is_read', false)
    }
  }

  function go(n) {
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  if (!currentUser) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label="Notifications" style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, color: 'var(--txD)' }}>
        🔔
        {unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 100, background: 'var(--tc)', color: '#FFF', fontFamily: 'var(--ui)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, maxHeight: 420, overflowY: 'auto', background: 'var(--sf)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.14)', zIndex: 100 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--txD)', position: 'sticky', top: 0, background: 'var(--sf)' }}>Notifications</div>
          {items.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)' }}>Nothing yet.</div>
          ) : items.map(n => (
            <div key={n.id} onClick={() => go(n)} style={{ display: 'flex', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: n.is_read ? 'none' : 'rgba(194,122,90,0.05)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {n.type === 'club_post'
                    ? <span style={{ fontWeight: 700 }}>{clubPostText(n)}</span>
                    : <><span style={{ fontWeight: 700 }}>{n.actor ? `${n.actor.first_name} ${n.actor.last_name}` : 'Someone'}</span>{' '}{VERB[n.type] || 'sent a notification'}{n.preview ? <span style={{ color: 'var(--txD)' }}>{`: “${n.preview}”`}</span> : ''}</>}
                </div>
                <div style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txD)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
