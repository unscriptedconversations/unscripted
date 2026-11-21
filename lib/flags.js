// Feature flags. Flip a value and redeploy — no other code change needed.
//
// BRIDGE_ENABLED: the cross-club "Bridge" pillar (the /bridge routes + their
// nav links, backed by the bridge_threads / bridge_posts tables). Set to false
// to hide Bridge everywhere it's gated on this flag, WITHOUT deleting the pages
// or dropping the tables. Flip back to true to restore the pillar exactly as-is.
export const BRIDGE_ENABLED = false

// APPLE_SIGNIN_ENABLED: the "Continue with Apple" button on the login page.
// Keep false until Apple sign-in is set up in Supabase (Authentication ->
// Sign In / Providers -> Apple), which needs a paid Apple Developer account.
// Flip to true to show the button again.
export const APPLE_SIGNIN_ENABLED = false
