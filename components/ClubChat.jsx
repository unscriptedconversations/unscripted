 // components/ClubChat.jsx
// Real-time casual side-channel for a club. Self-contained: give it a clubId and
// it resolves its own session/member/host, loads full history (no join-date gate),
// subscribes to Supabase Realtime, and handles posting + deleting.
//
// Delete: your own message, or any message if you host this club (mirrors the
// club_messages RLS, so the UI only offers what the DB will allow).
//
// Realtime: INSERT is filtered to this club; DELETE can't be club-filtered
// (the old record carries only the PK), so we just drop by id — harmless, since
// we'd never be holding another club's message in state anyway.

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { notifyMentions } from '../lib/notify'

const fmtTime = (ts) => {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

const labelFor = (m) => (m?.first_name || m?.initials || '—')

// Small avatar used in the welcome/empty state.
function Avatar({ member, size = 34 }) {
  const initials = member?.initials || (member?.first_name || '—')[0]
  return (
    <div style={{
      flex: '0 0 auto', width: size, height: size, borderRadius: '50%',
      background: member?.color || 'var(--tc)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--ui)', fontSize: size * 0.36, fontWeight: 700,
      border: '2px solid var(--sf)',
    }}>
      {initials}
    </div>
  )
}

export default function ClubChat({ clubId }) {
  const router = useRouter()
  const [me, setMe] = useState(null)          // { id, first_name, initials, color }
  const [isHost, setIsHost] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [ready, setReady] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatHidden, setChatHidden] = useState(false)

  const memberCache = useRef(new Map())       // member_id -> { first_name, initials, color }
  const rosterRef = useRef([])                // [{ id, first_name, last_name }] for @mention resolution
  const scrollRef = useRef(null)
  const meRef = useRef(null)

  useEffect(() => {
    let channel
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setReady(true); return }

      const { data: member } = await supabase
        .from('members')
        .select('id, first_name, initials, color')
        .eq('auth_id', session.user.id)
        .maybeSingle()
      if (!member) { setReady(true); return }
      setMe(member); meRef.current = member
      memberCache.current.set(member.id, member)

      const { data: membership } = await supabase
        .from('club_members')
        .select('role, chat_hidden')
        .eq('club_id', clubId)
        .eq('member_id', member.id)
        .maybeSingle()
      setIsHost(membership?.role === 'host')
      setChatHidden(!!membership?.chat_hidden)

      // Roster for @mention → member-id resolution (same shape notifyMentions uses elsewhere).
      const { data: roster } = await supabase
        .from('club_members')
        .select('members(id, first_name, last_name, initials, color)')
        .eq('club_id', clubId)
      rosterRef.current = (roster || []).map((r) => r.members).filter(Boolean)

      const { data: history } = await supabase
        .from('club_messages')
        .select('id, content, created_at, member_id, members(first_name, initials, color)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: true })

      const rows = history || []
      for (const r of rows) if (r.members) memberCache.current.set(r.member_id, r.members)
      setMessages(rows)
      setReady(true)

      channel = supabase
        .channel(`club_messages:${clubId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'club_messages', filter: `club_id=eq.${clubId}` },
          handleInsert)
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'club_messages' },
          (payload) => {
            const id = payload.old?.id
            if (id) setMessages((prev) => prev.filter((m) => m.id !== id))
          })
        .subscribe()
    })()

    return () => { if (channel) supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  // Keep pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function handleInsert(payload) {
    const row = payload.new
    if (!row) return
    let member = memberCache.current.get(row.member_id)
    if (!member) {
      const { data } = await supabase
        .from('members').select('first_name, initials, color').eq('id', row.member_id).maybeSingle()
      member = data || null
      if (member) memberCache.current.set(row.member_id, member)
    }
    setMessages((prev) =>
      prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, members: member }]
    )
  }

  // Highlight "@name" as a link to the member's profile when it matches a club
  // member. Same matching rules as the club page's renderContent (first name or
  // full name, underscores tolerated). Uses the roster we loaded on mount.
  function renderContent(text) {
    if (!text) return text
    const roster = rosterRef.current || []
    return String(text).split(/(@[A-Za-z0-9_]+)/g).map((part, i) => {
      if (part[0] !== '@') return part
      const h = part.slice(1).toLowerCase()
      const hClean = h.replace(/_/g, '')
      const m = roster.find((mm) => {
        const fn = (mm.first_name || '').toLowerCase()
        const full = ((mm.first_name || '') + (mm.last_name || '')).toLowerCase()
        return h === fn || full === hClean || full === h
      })
      if (!m) return part
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${m.id}`) }}
          style={{ color: 'var(--tc)', fontWeight: 600, cursor: 'pointer' }}
        >
          @{m.first_name}
        </span>
      )
    })
  }

  async function leaveChat() {
    if (!me) return
    if (!window.confirm('Leave this chat? You can rejoin anytime — you stay a club member.')) return
    setChatHidden(true) // optimistic
    const { error } = await supabase
      .from('club_members')
      .update({ chat_hidden: true })
      .eq('club_id', clubId)
      .eq('member_id', me.id)
    if (error) setChatHidden(false)
  }

  async function rejoinChat() {
    if (!me) return
    setChatHidden(false) // optimistic
    const { error } = await supabase
      .from('club_members')
      .update({ chat_hidden: false })
      .eq('club_id', clubId)
      .eq('member_id', me.id)
    if (error) setChatHidden(true)
  }

  async function send() {
    const body = text.trim()
    if (!body || sending || !me) return
    setSending(true)
    setText('')
    const { data, error } = await supabase
      .from('club_messages')
      .insert({ club_id: clubId, member_id: me.id, content: body })
      .select('id, content, created_at, member_id')
      .single()
    setSending(false)
    if (error) { setText(body); return } // restore on failure
    // Optimistic append; the realtime echo dedupes by id.
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, { ...data, members: me }]
    )
    // Notify anyone @mentioned — same helper the feed and threads use. Fire-and-forget.
    notifyMentions({
      text: body,
      members: rosterRef.current,
      actorId: me.id,
      link: `/club/${clubId}`,
      preview: body.slice(0, 60),
    })
  }

  async function remove(msg) {
    const canDelete = isHost || msg.member_id === me?.id
    if (!canDelete) return
    const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content
    if (!window.confirm(`Delete this message?\n\n"${preview}"`)) return
    setMessages((prev) => prev.filter((m) => m.id !== msg.id)) // optimistic
    const { error } = await supabase.from('club_messages').delete().eq('id', msg.id)
    if (error) setMessages((prev) => [...prev, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!ready) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--txM)', fontFamily: 'var(--ui)' }}>Loading chat…</div>
  }
  if (!me) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--txM)', fontFamily: 'var(--ui)' }}>Sign in to join the chat.</div>
  }
  if (chatHidden) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--hd)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>You've left this chat</div>
        <p style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txM)', marginBottom: 22 }}>You're still a club member — rejoin whenever you like.</p>
        <button onClick={rejoinChat} style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--tc)', border: 'none', borderRadius: 12, padding: '10px 22px', cursor: 'pointer' }}>
          Rejoin chat
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 380 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 6 }}>
        <span role="button" onClick={leaveChat} style={{ fontFamily: 'var(--ui)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--txM)', cursor: 'pointer' }}>
          Leave chat
        </span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
            {rosterRef.current.length > 0 && (
              <div style={{ display: 'flex', marginBottom: 18 }}>
                {rosterRef.current.slice(0, 5).map((mm, i) => (
                  <div key={mm.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar member={mm} size={44} /></div>
                ))}
              </div>
            )}
            <div style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Welcome to the chat</div>
            <p style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--txM)', maxWidth: 360, lineHeight: 1.5 }}>
              This is the beginning of your club's chat. Say hello, react to what you're reading, or drop a half-formed thought.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mem = m.members || memberCache.current.get(m.member_id)
            const mine = m.member_id === me.id
            const canDelete = isHost || mine
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, padding: '7px 6px', alignItems: 'flex-start' }}>
                <div style={{
                  flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%',
                  background: mem?.color || 'var(--tc)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700,
                }}>
                  {mem?.initials || '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {labelFor(mem)}
                    </span>
                    <span style={{ fontFamily: 'var(--ui)', fontSize: 11, color: 'var(--txM)' }}>{fmtTime(m.created_at)}</span>
                    {canDelete && (
                      <span
                        role="button"
                        aria-label="Delete message"
                        onClick={() => remove(m)}
                        style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--txM)', fontSize: 12, padding: '0 4px' }}
                      >
                        ✕
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {renderContent(m.content)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message the club…"
          style={{
            flex: 1, resize: 'none', maxHeight: 120, padding: '10px 12px',
            fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink)',
            background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12, outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            flex: '0 0 auto', padding: '10px 18px', cursor: text.trim() ? 'pointer' : 'default',
            fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600, color: '#fff',
            background: text.trim() ? 'var(--tc)' : 'var(--bd2)', border: 'none', borderRadius: 12,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
