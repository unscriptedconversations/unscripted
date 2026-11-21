// pages/api/club-email.js
// Club email blasts. A club's host sends one message; every member who hasn't
// opted out gets their own copy (nobody sees anyone else's address), and a copy
// is posted in the club as an announcement so opted-out members still see it.
//
// Server-only secrets (Vercel → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  bypasses RLS — never expose to the browser
//   RESEND_API_KEY             sends the emails
//   EMAIL_FROM                 a verified sender, e.g. noreply@yourdomain
//
// Guards: caller must be signed in AND a host of the club; one email per club
// per 24 hours (logged in club_emails); subject/body length caps.

import { createClient } from '@supabase/supabase-js'

const MAX_SUBJECT = 120
const MAX_BODY = 5000
const WINDOW_MS = 24 * 60 * 60 * 1000
const BATCH = 100 // Resend batch limit

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function emailHtml({ clubName, subject, body, hostName, clubUrl, settingsUrl }) {
  const paras = esc(body).split(/\n{2,}/).map(p => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F7F3EC;font-family:Georgia,serif;color:#2C2C2A">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:32px">
<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A0603E;margin-bottom:8px">${esc(clubName)}</div>
<h1 style="font-size:24px;margin:0 0 20px;font-weight:600">${esc(subject)}</h1>
${paras}
<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#6B6B66">From ${esc(hostName)}, host of ${esc(clubName)}</p>
<p style="margin:20px 0 0"><a href="${esc(clubUrl)}" style="display:inline-block;background:#A0603E;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:12px 20px;border-radius:10px">Open the club</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;color:#8A8A85;line-height:1.6;text-align:center">
You're getting this because you're a member of ${esc(clubName)} on unscripted. Replies to this email aren't read; reply in the club instead.<br>
<a href="${esc(settingsUrl)}" style="color:#8A8A85">Turn off club emails</a></p>
</body></html>`
}

function emailText({ clubName, subject, body, hostName, clubUrl, settingsUrl }) {
  return `${clubName}\n\n${subject}\n\n${body}\n\nFrom ${hostName}, host of ${clubName}\nOpen the club: ${clubUrl}\n\n--\nYou're getting this because you're a member of ${clubName} on unscripted. Replies to this email aren't read; reply in the club instead.\nTurn off club emails: ${settingsUrl}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!url || !serviceKey || !resendKey || !from) {
    return res.status(503).json({ error: 'Club email isn’t set up yet.', code: 'NOT_CONFIGURED' })
  }

  // Who's asking?
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Please log in again.', code: 'NO_SESSION' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (userErr || !uid) return res.status(401).json({ error: 'Please log in again.', code: 'BAD_SESSION' })

  // Validate input
  const clubId = String(req.body?.clubId || '')
  const subject = String(req.body?.subject || '').trim()
  const body = String(req.body?.body || '').trim()
  if (!clubId) return res.status(400).json({ error: 'Missing club.', code: 'NO_CLUB' })
  if (!subject || subject.length > MAX_SUBJECT) return res.status(400).json({ error: `Add a subject (up to ${MAX_SUBJECT} characters).`, code: 'BAD_SUBJECT' })
  if (!body || body.length > MAX_BODY) return res.status(400).json({ error: `Add a message (up to ${MAX_BODY} characters).`, code: 'BAD_BODY' })

  // Club + host check (role 'host', or the club's creator)
  const { data: club } = await admin.from('clubs').select('id, name, creator_id').eq('id', clubId).maybeSingle()
  if (!club) return res.status(404).json({ error: 'Club not found.', code: 'NO_CLUB' })
  const { data: hostRow } = await admin.from('club_members').select('member_id').eq('club_id', clubId).eq('member_id', uid).eq('role', 'host').maybeSingle()
  if (!hostRow && club.creator_id !== uid) return res.status(403).json({ error: 'Only the club’s host can email members.', code: 'NOT_HOST' })

  // Once per club per 24h
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data: recent } = await admin.from('club_emails').select('created_at').eq('club_id', clubId).gte('created_at', since).order('created_at', { ascending: false }).limit(1)
  if (recent && recent.length) {
    const next = new Date(new Date(recent[0].created_at).getTime() + WINDOW_MS)
    return res.status(429).json({ error: 'This club already sent an email in the last 24 hours.', code: 'DAILY_LIMIT', nextAt: next.toISOString() })
  }

  // Recipients: members (not the sender), not opted out, not disabled, with an email
  const { data: rows, error: memErr } = await admin
    .from('club_members')
    .select('member_id, member:members(id, email, first_name, status, club_email_opt_out)')
    .eq('club_id', clubId)
  if (memErr) return res.status(500).json({ error: 'Couldn’t load club members.', code: 'MEMBERS_ERROR' })
  const all = (rows || []).map(r => r.member).filter(m => m && m.id !== uid)
  const optedOut = all.filter(m => m.club_email_opt_out).length
  const recipients = all.filter(m => !m.club_email_opt_out && m.status !== 'disabled' && /\S+@\S+\.\S+/.test(m.email || ''))

  const { data: sender } = await admin.from('members').select('first_name, last_name').eq('id', uid).maybeSingle()
  const hostName = [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') || 'Your host'
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const clubUrl = `${origin}/club/${clubId}`
  const safeClubName = String(club.name || 'Your club').replace(/[<>"\r\n]/g, '').slice(0, 60)
  const fromHeader = `${safeClubName} via unscripted <${from}>`

  // Send in batches; each member gets their own email
  let sent = 0
  const failures = []
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH)
    const payload = chunk.map(m => {
      const settingsUrl = `${origin}/profile/${m.id}?tab=account`
      const ctx = { clubName: safeClubName, subject, body, hostName, clubUrl, settingsUrl }
      return { from: fromHeader, to: [m.email], subject: `${subject} · ${safeClubName}`, html: emailHtml(ctx), text: emailText(ctx) }
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

  if (recipients.length && !sent) {
    console.error('club-email: all batches failed', failures)
    return res.status(502).json({ error: 'The email service didn’t accept the message. Please try again later.', code: 'SEND_FAILED' })
  }

  // Log (powers the daily limit) and post the announcement in the club
  await admin.from('club_emails').insert({ club_id: clubId, sender_id: uid, subject, body, recipient_count: sent })
  await admin.from('posts').insert({ member_id: uid, club_id: clubId, tag: 'announcement', content: `📣 ${subject}\n\n${body}` })

  if (failures.length) console.error('club-email: some batches failed', failures)
  return res.status(200).json({ sent, optedOut, partial: failures.length > 0 })
}
