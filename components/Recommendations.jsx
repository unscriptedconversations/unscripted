// components/Recommendations.jsx
// "Recommended for you" — home-screen book recommendations.
//
// PLACEHOLDER SCAFFOLD (renders nothing). The previous contents of this file
// were an accidental duplicate of ClubChat.jsx (wrong-file paste); the original
// recommendations component was lost. This is a safe, correctly-named stand-in
// so nothing renders club chat on the home again.
//
// TO ACTIVATE (future, AI-powered):
//   1. Ensure ANTHROPIC_API_KEY is set in Vercel so /api/recommend is live.
//   2. Fetch recommendations for the signed-in member and render book cards.
//   3. Re-add to pages/index.js where the {/* AD BANNER */} comment now sits:
//        {/* RECOMMENDED FOR YOU */}
//        {currentUser && <Recommendations />}
//      (import Recommendations from '../components/Recommendations')
//
// IDENTITY REMINDER: resolve the current member with .eq('id', session.user.id).
// members.auth_id is null/unused — never key off auth_id.
//
// Sketch of the intended shape (left commented until the endpoint is verified):
//
//   const { data: { session } } = await supabase.auth.getSession()
//   if (!session) return
//   const res = await fetch('/api/recommend', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ memberId: session.user.id }),
//   })
//   const { books } = await res.json()   // confirm the real response shape
//   setRecs(books || [])

export default function Recommendations() {
  // No-op until the AI recommendation feature is built and wired.
  return null
}
