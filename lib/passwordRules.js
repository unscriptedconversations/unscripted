// lib/passwordRules.js
// Turns Supabase's "weak_password" error into a plain message that says what
// to fix. Supabase's own rules live in the dashboard (Authentication → Sign In
// / Providers → Email → Password requirements, and leaked-password protection),
// so we read its answer rather than guessing:
//   err.reasons  — any of 'length', 'characters', 'pwned' (supabase-js v2)
//   err.message  — lists the required character groups for 'characters'
// Pass the password too and only the missing groups are named.

export function isWeakPassword(err) {
  return err?.code === 'weak_password' || err?.name === 'AuthWeakPasswordError' || Array.isArray(err?.reasons)
}

export function weakPasswordText(err, password = '') {
  const msg = String(err?.message || '')
  const low = msg.toLowerCase()
  const reasons = Array.isArray(err?.reasons) ? err.reasons : []
  const pw = String(password || '')

  if (reasons.includes('pwned') || /pwned|leaked|known to be weak|breach/.test(low)) {
    return 'That password has appeared in a data breach somewhere else online, so it isn’t safe to use. Please choose one you haven’t used before.'
  }

  const lenMatch = low.match(/at least (\d+) characters?/)
  const minLen = lenMatch ? Number(lenMatch[1]) : 0
  const tooShort = reasons.includes('length') || (minLen && pw.length < minLen)

  // Required groups, as listed in Supabase's message
  const groups = []
  if (msg.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')) {
    groups.push({ label: 'a letter', ok: /[A-Za-z]/.test(pw) })
  } else {
    if (msg.includes('abcdefghijklmnopqrstuvwxyz')) groups.push({ label: 'a lowercase letter', ok: /[a-z]/.test(pw) })
    if (msg.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ')) groups.push({ label: 'a capital letter', ok: /[A-Z]/.test(pw) })
  }
  if (msg.includes('0123456789')) groups.push({ label: 'a number', ok: /[0-9]/.test(pw) })
  if (/[!@#$%^&*]/.test(msg)) groups.push({ label: 'a symbol (like ! or #)', ok: /[^A-Za-z0-9\s]/.test(pw) })

  const missing = groups.filter(g => !pw || !g.ok).map(g => g.label)
  const parts = []
  if (tooShort) parts.push(`at least ${minLen || 8} characters`)
  parts.push(...missing)

  if (parts.length) {
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    return `Your password needs ${list}.`
  }
  return 'That password is too easy to guess. Please try a longer one with a mix of letters, numbers and symbols.'
}
