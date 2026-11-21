import { useRouter } from 'next/router'
import Logo from '../components/Logo'

// Privacy policy. Plain-language draft written from what the site actually
// collects — have it reviewed before relying on it. Update EFFECTIVE and the
// sections below whenever data handling changes (e.g. turning on AI features).
const EFFECTIVE = 'November 21, 2026'
const CONTACT = 'unscriptedbookclub3@gmail.com'

const H = ({ children }) => (
  <h2 style={{ fontFamily: 'var(--hd)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: '40px 0 12px' }}>{children}</h2>
)
const P = ({ children }) => (
  <p style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.75, margin: '0 0 14px' }}>{children}</p>
)
const UL = ({ children }) => (
  <ul style={{ fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.75, margin: '0 0 14px', paddingLeft: 22 }}>{children}</ul>
)

export default function Privacy() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
          <a href="/terms" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--txD)' }}>Terms</a>
        </div>

        <h1 style={{ fontFamily: 'var(--hd)', fontSize: 40, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>Privacy Policy</h1>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginBottom: 32 }}>Effective {EFFECTIVE}</div>

        <P>unscripted is a place to read together, talk about books, and share writing. This policy explains what we collect, why, who helps us run the service, and the choices you have. unscripted is currently in beta, and we&rsquo;ll update this page as the service changes.</P>

        <H>What we collect</H>
        <P><strong>Information you give us</strong></P>
        <UL>
          <li>Your account details: first and last name, email address, and password (passwords are stored in encrypted form; we can&rsquo;t see them). If you sign in with Google or Apple, we receive your name and email from that service.</li>
          <li>Your profile: anything you add, such as a favorite book, a cartoon character, a word that describes you, and your chosen color.</li>
          <li>Your reading: books on your shelves, your reading progress, the reading goals and topics you pick at signup, and private notes you save on books.</li>
          <li>What you post: feed posts, discussion replies, likes, club chat messages, and writing you save or publish.</li>
          <li>Your clubs: clubs you create or join, and your role in them.</li>
          <li>Feedback: notes you send through &ldquo;Send feedback,&rdquo; and any reasons you share when disabling or deleting your account.</li>
        </UL>
        <P><strong>Information collected as you use unscripted</strong></P>
        <UL>
          <li>Searches you make while logged in, which we use to show trending searches and suggest clubs and topics. We never show search terms that match a member&rsquo;s name.</li>
          <li>When you last visited each of your clubs, so we can show what&rsquo;s new.</li>
          <li>When you send feedback, the page you were on and your browser or device type, so we can fix problems.</li>
        </UL>
        <P>We don&rsquo;t use advertising trackers or third-party analytics, and we don&rsquo;t sell your information.</P>

        <H>How we use it</H>
        <UL>
          <li>To run the service: create your account, show your profile and clubs, deliver posts and notifications, and keep you signed in.</li>
          <li>To personalize it: suggest clubs and topics, and show trending searches and featured books, clubs, and authors.</li>
          <li>To communicate with you: account emails such as confirming your email address and resetting your password, and announcements from the hosts of clubs you join (see below).</li>
          <li>To keep unscripted safe and improve it: respond to feedback, fix bugs, and enforce our <a href="/terms" style={{ color: 'var(--tc)' }}>Terms</a>.</li>
        </UL>

        <H>What other people can see</H>
        <P>Your name, profile, and anything you publish (published writing and posts) can be seen by other members. Posts, replies, and chat inside a club are visible to that club&rsquo;s members; anything in an open club may be visible to anyone who visits it. Drafts and your private book notes are shown only to you.</P>

        <H>Club announcement emails</H>
        <P>A club&rsquo;s host can send an announcement to the club&rsquo;s members, at most once a day. We deliver it to your email address on the host&rsquo;s behalf: the host never sees your address, and members never see each other&rsquo;s. Each announcement is also posted in the club. You can turn club emails off anytime in Settings, or with the link at the bottom of any club email.</P>

        <H>Services that help us run unscripted</H>
        <P>We share information only as needed to operate the service, with providers that process it on our behalf:</P>
        <UL>
          <li><strong>Supabase</strong>: our database and sign-in system, where your account and content are stored.</li>
          <li><strong>Vercel</strong>: hosts the website.</li>
          <li><strong>Resend</strong>: sends account emails such as confirmations and password resets, and club announcement emails.</li>
          <li><strong>Open Library</strong> (Internet Archive): when you search for or look up a book, the search text is sent to Open Library to find titles and covers. No account information is sent with it.</li>
          <li><strong>Google and Apple</strong>: only if you choose to sign in with them.</li>
        </UL>
        <P>We may also share information if required by law, or to protect the safety of our members or the public.</P>
        <P>unscripted does not currently use AI features on your content. If we turn any on, we&rsquo;ll update this policy first and explain what is shared.</P>

        <H>Your choices</H>
        <UL>
          <li><strong>Edit</strong> your profile at any time.</li>
          <li><strong>Delete</strong> your own posts, replies, and writing. Hosts can also remove posts in their clubs. When a reply that others answered is deleted, its text is erased and it shows as removed, so the replies to it stay readable.</li>
          <li><strong>Turn off club emails</strong> in Settings.</li>
          <li><strong>Disable</strong> your account from Settings; logging in again reactivates it.</li>
          <li><strong>Delete</strong> your account from Settings, which removes your profile. To have your sign-in record and any remaining data removed, or to request a copy of your information, email us at <a href={`mailto:${CONTACT}`} style={{ color: 'var(--tc)' }}>{CONTACT}</a>.</li>
        </UL>
        <P>Depending on where you live, you may have additional rights over your information. Contact us and we&rsquo;ll help.</P>

        <H>Browser storage</H>
        <P>We store a small amount of information in your browser to keep you signed in and to make pages load faster (for example, your name in the top menu). We don&rsquo;t use it to track you across other sites. Clearing your browser&rsquo;s site data signs you out.</P>

        <H>Keeping information safe and how long we keep it</H>
        <P>We use our providers&rsquo; security protections and limit who can read or change information. No system is perfectly secure, so please use a strong, unique password. We keep your information while your account exists. When you delete something, it&rsquo;s removed from the service, though copies may remain in backups for a limited time.</P>

        <H>Age requirement</H>
        <P>unscripted is for people 18 and older. We don&rsquo;t knowingly collect information from anyone under 18. If you believe someone under 18 has an account, contact us and we&rsquo;ll remove it.</P>

        <H>Changes to this policy</H>
        <P>If we make meaningful changes, we&rsquo;ll update the date above and let members know on the site or by email.</P>

        <H>Contact</H>
        <P>Questions or requests: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--tc)' }}>{CONTACT}</a></P>
      </div>
    </div>
  )
}
