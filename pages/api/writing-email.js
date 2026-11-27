// pages/api/writing-email.js
// Emails a newly published piece to the writer's followers, once per piece.
// Called by the editor right after a first publish (fire-and-forget).
//
// Checks: signed in; the caller wrote the piece; it's published; it hasn't
// been emailed before (writing_emails is claimed BEFORE sending, so double
// clicks or re-publishing an edit never resend).
// Recipients: followers (writing_follows) who haven't turned these emails off
// (members.writing_email_opt_out) and aren't disabled; addresses come from
// Supabase Auth, never from the public members table.
// Same env vars as club emails: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM.

import { createClient } from '@supabase/supabase-js'
import { plainText } from '../../lib/formatText'

const BATCH = 100          // Resend batch limit
const MAX_FOLLOWERS = 2000 // safety cap per piece

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function emailHtml({ writer, title, subtitle, excerpt, coverUrl, url, settingsUrl }) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F7F3EC;font-family:Georgia,serif;color:#2C2C2A">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden">
${coverUrl ? `<img src="${esc(coverUrl)}" alt="" width="560" style="display:block;width:100%;max-height:280px;object-fit:cover">` : ''}
<div style="padding:32px">
<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A0603E;margin-bottom:8px">New from ${esc(writer)}</div>
<h1 style="font-size:26px;line-height:1.2;margin:0 0 ${subtitle ? '8px' : '18px'};font-weight:600">${esc(title)}</h1>
${subtitle ? `<p style="margin:0 0 18px;font-size:17px;font-style:italic;color:#6B6B66">${esc(subtitle)}</p>` : ''}
<p style="margin:0 0 22px;font-size:16px;line-height:1.65">${esc(excerpt)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#A0603E;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:12px 20px;border-radius:10px">Read the piece</a>
</div></div>
<p style="max-width:560px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;color:#8A8A85;line-height:1.6;text-align:center">
You're getting this because you follow ${esc(writer)} on unscripted. Replies to this email aren't read.<br>
<a href="${esc(settingsUrl)}" style="color:#8A8A85">Turn off emails about new pieces</a></p>
</body></html>`
}

function emailText({ writer, title, subtitle, excerpt, url, settingsUrl }) {
  return `New from ${writer}\n\n${title}${subtitle ? `\n${subtitle}` : ''}\n\n${excerpt}\n\nRead the piece: ${url}\n\n--\nYou're getting this because you follow ${writer} on unscripted. Replies to this email aren't read.\nTurn off emails about new pieces: ${settingsUrl}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!url || !serviceKey || !resendKey || !from) return res.status(503).json({ error: 'Follower emails aren’t set up yet.', code: 'NOT_CONFIGURED' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Please log in again.', code: 'NO_SESSION' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (userErr || !uid) return res.status(401).json({ error: 'Please log in again.', code: 'BAD_SESSION' })

  const writingId = String(req.body?.writingId || '')
  if (!/^[0-9a-f-]{36}$/i.test(writingId)) return res.status(400).json({ error: 'Missing piece.', code: 'NO_PIECE' })
  const { data: w } = await admin.from('writings').select('id, title, subtitle, content, cover_url, is_published, member_id').eq('id', writingId).maybeSingle()
  if (!w) return res.status(404).json({ error: 'Piece not found.', code: 'NO_PIECE' })
  if (w.member_id !== uid) return res.status(403).json({ error: 'Only the writer can send this.', code: 'NOT_WRITER' })
  if (!w.is_published) return res.status(400).json({ error: 'Publish the piece first.', code: 'NOT_PUBLISHED' })

  // Claim this piece in the log first; a second call finds the row and stops
  const { error: claimErr } = await admin.from('writing_emails').insert({ writing_id: w.id, sender_id: uid, recipient_count: 0 })
  if (claimErr) {
    if (claimErr.code === '23505') return res.status(200).json({ sent: 0, already: true })
    return res.status(500).json({ error: 'Couldn’t start sending.', code: 'LOG_FAILED' })
  }

  // Followers who want these emails
  const { data: follows } = await admin.from('writing_follows').select('follower_member_id').eq('writer_member_id', uid).limit(MAX_FOLLOWERS)
  const ids = [...new Set((follows || []).map(f => f.follower_member_id).filter(id => id && id !== uid))]
  let eligible = []
  if (ids.length) {
    const { data: ms } = await admin.from('members').select('id, status, writing_email_opt_out').in('id', ids)
    eligible = (ms || []).filter(m => !m.writing_email_opt_out && m.status !== 'disabled')
  }
  const emailById = {}
  for (let i = 0; i < eligible.length; i += 10) {
    await Promise.all(eligible.slice(i, i + 10).map(async m => {
      try {
        const { data } = await admin.auth.admin.getUserById(m.id)
        if (data?.user?.email) emailById[m.id] = data.user.email
      } catch (e) { /* skip this follower */ }
    }))
  }
  const recipients = eligible.filter(m => /\S+@\S+\.\S+/.test(emailById[m.id] || '')).map(m => ({ id: m.id, email: emailById[m.id] }))
  if (!recipients.length) return res.status(200).json({ sent: 0 })

  const { data: me } = await admin.from('members').select('first_name, last_name').eq('id', uid).maybeSingle()
  const writer = [me?.first_name, me?.last_name].filter(Boolean).join(' ') || 'A writer you follow'
  const safeWriter = writer.replace(/[<>"\r\n]/g, '').slice(0, 60)
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const pieceUrl = `${origin}/writing/${w.id}`
  const plain = plainText(w.content).replace(/\s+/g, ' ').trim()
  const excerpt = plain.length > 300 ? plain.slice(0, 300).replace(/\s+\S*$/, '') + '…' : plain
  const title = String(w.title || 'A new piece').slice(0, 150)
  const subtitle = w.subtitle ? String(w.subtitle).slice(0, 200) : ''
  const coverUrl = w.cover_url && /^https:\/\//.test(w.cover_url) ? w.cover_url : ''

  let sent = 0
  const failures = []
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH)
    const payload = chunk.map(r => {
      const ctx = { writer: safeWriter, title, subtitle, excerpt, coverUrl, url: pieceUrl, settingsUrl: `${origin}/profile/${r.id}?tab=account` }
      return { from: `${safeWriter} on unscripted <${from}>`, to: [r.email], subject: `New from ${safeWriter}: ${title}`, html: emailHtml(ctx), text: emailText(ctx) }
    })
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) sent += chunk.length
      else failures.push(`${r.status}: ${(await r.text()).slice(0, 200)}`)
    } catch (e) {
      failures.push(String(e?.message || e).slice(0, 200))
    }
  }

  await admin.from('writing_emails').update({ recipient_count: sent }).eq('writing_id', w.id)
  if (failures.length) console.error('writing-email: some batches failed', failures)
  if (!sent) return res.status(502).json({ error: 'The email service didn’t accept the message.', code: 'SEND_FAILED' })
  return res.status(200).json({ sent, partial: failures.length > 0 })
}
