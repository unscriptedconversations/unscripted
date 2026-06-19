import { supabase } from './supabase'

// Sign up a new user. Profile data is stashed in auth metadata since the
// members row can't be created until the email is confirmed and a real
// session exists (RLS requires auth.uid() to match).
export async function signUp({ email, password, firstName, lastName, color }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { first_name: firstName.trim(), last_name: lastName.trim(), color },
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
    },
  })
  return { data, error }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (data?.user) await ensureMemberProfile(data.user)
  return { data, error }
}

export async function signOut() {
  await supabase.auth.signOut()
  try { window.localStorage?.removeItem?.('unscripted_user') } catch (e) {}
}

export async function resendConfirmation(email) {
  return supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
}

// Update the logged-in member's chosen identity color, and keep the
// localStorage cache other pages read from in sync.
export async function updateColor(memberId, color) {
  const { data, error } = await supabase.from('members').update({ color }).eq('id', memberId).select().single()
  if (data) {
    try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch (e) {}
  }
  return { data, error }
}

// Called after signup confirmation or login. If a members row doesn't exist
// yet for this auth user, create it from the metadata stashed at signup.
// Mirrors the result into localStorage so existing pages (which read
// 'unscripted_user' from localStorage) keep working unchanged.
export async function ensureMemberProfile(authUser) {
  if (!authUser) return null

  const { data: existing } = await supabase.from('members').select('*').eq('auth_id', authUser.id).maybeSingle()
  if (existing) {
    try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(existing)) } catch (e) {}
    return existing
  }

  const meta = authUser.user_metadata || {}
  const firstName = meta.first_name || ''
  const lastName = meta.last_name || ''
  const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase()

  const { data: created, error } = await supabase.from('members').insert({
    auth_id: authUser.id,
    first_name: firstName,
    last_name: lastName,
    email: authUser.email,
    initials,
    color: meta.color || '#8B6E52',
  }).select().single()

  if (error) {
    console.error('Failed to create member profile:', error)
    return null
  }

  try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(created)) } catch (e) {}
  return created
}
