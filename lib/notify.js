import { supabase } from './supabase'

// Create a single notification. No-ops on self-notify or missing ids.
export async function createNotification({ recipientId, actorId, type, link, preview }) {
  if (!recipientId || !actorId || recipientId === actorId) return
  try {
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      link: link || null,
      preview: preview || null,
    })
  } catch (e) { /* non-blocking */ }
}

// Parse @mentions from text, resolve against a member list, notify each once.
// `members` is any array of { id, first_name, last_name } already loaded by the caller.
export async function notifyMentions({ text, members, actorId, link, preview }) {
  if (!text || !members?.length || !actorId) return
  const handles = [...text.matchAll(/@([A-Za-z0-9_]+)/g)].map(m => m[1].toLowerCase())
  if (!handles.length) return
  const seen = new Set()
  for (const h of handles) {
    const hClean = h.replace(/_/g, '')
    const m = members.find(mm => {
      const fn = (mm.first_name || '').toLowerCase()
      const full = ((mm.first_name || '') + (mm.last_name || '')).toLowerCase()
      return h === fn || full === hClean || full === h
    })
    if (m && !seen.has(m.id)) {
      seen.add(m.id)
      await createNotification({ recipientId: m.id, actorId, type: 'mention', link, preview })
    }
  }
}

// Club-post notifications, coalesced within a 6-hour window into one
// "N new posts in [club]" row per recipient. `recipients` = member ids
// (the club's members minus the poster). Runs client-side from the poster.
const CLUB_WINDOW_MS = 6 * 60 * 60 * 1000
export async function notifyClubPost({ recipients, actorId, clubId, clubName }) {
  if (!recipients?.length || !actorId || !clubId) return
  const groupKey = `club_post:${clubId}`
  const since = new Date(Date.now() - CLUB_WINDOW_MS).toISOString()
  for (const rid of recipients) {
    if (rid === actorId) continue
    try {
      // Is there a recent unread group row to roll into?
      const { data: existing } = await supabase
        .from('notifications')
        .select('id, count')
        .eq('recipient_id', rid)
        .eq('group_key', groupKey)
        .eq('is_read', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) {
        await supabase.from('notifications')
          .update({ count: (existing.count || 1) + 1, actor_id: actorId, created_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('notifications').insert({
          recipient_id: rid, actor_id: actorId, type: 'club_post',
          link: `/club/${clubId}`, preview: clubName || null, group_key: groupKey, count: 1,
        })
      }
    } catch (e) { /* non-blocking */ }
  }
}
