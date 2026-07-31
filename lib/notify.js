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
