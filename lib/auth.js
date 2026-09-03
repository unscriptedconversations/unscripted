import { supabase } from './supabase'

// IDENTITY CONVENTION (live):
//   The member link is  members.id = auth.uid()  — set at signup in
//   pages/signup.js as `id: authUserId`. The members.auth_id column is
//   unused / null in this database. Resolve the current member with
//   `.eq('id', session.user.id)`, NEVER `.eq('auth_id', ...)`.
//
// The previous auth_id-based wrappers (signUp / signIn / signOut /
// resendConfirmation / ensureMemberProfile) were dead code: nothing
// imported them — the app calls supabase.auth.* directly — and their
// auth_id insert never ran, which is why auth_id is null everywhere.
// They were removed to stop them misleading future work. Only the one
// live export used by the app (updateColor) remains.

// Update the logged-in member's chosen identity color, and keep the
// localStorage cache other pages read from in sync.
export async function updateColor(memberId, color) {
  const { data, error } = await supabase
    .from('members')
    .update({ color })
    .eq('id', memberId)
    .select()
    .single()
  if (data) {
    try { window.localStorage?.setItem?.('unscripted_user', JSON.stringify(data)) } catch (e) {}
  }
  return { data, error }
}
