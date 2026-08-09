// Feature flags. Flip a value and redeploy — no other code change needed.
//
// BRIDGE_ENABLED: the cross-club "Bridge" pillar (the /bridge routes + their
// nav links, backed by the bridge_threads / bridge_posts tables). Set to false
// to hide Bridge everywhere it's gated on this flag, WITHOUT deleting the pages
// or dropping the tables. Flip back to true to restore the pillar exactly as-is.
export const BRIDGE_ENABLED = false
