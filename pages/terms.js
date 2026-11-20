import { useRouter } from 'next/router'
import Logo from '../components/Logo'

// Terms of service. Plain-language beta draft — have it reviewed before
// relying on it. Update EFFECTIVE whenever the terms change.
const EFFECTIVE = 'November 20, 2026'
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

export default function Terms() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><Logo /></div>
          <a href="/privacy" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--txD)' }}>Privacy</a>
        </div>

        <h1 style={{ fontFamily: 'var(--hd)', fontSize: 40, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>Terms of Service</h1>
        <div style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--txD)', marginBottom: 32 }}>Effective {EFFECTIVE}</div>

        <P>Welcome to unscripted. By creating an account or using the site, you agree to these terms and to our <a href="/privacy" style={{ color: 'var(--tc)' }}>Privacy Policy</a>. If you don&rsquo;t agree, please don&rsquo;t use unscripted.</P>

        <H>A beta, built in the open</H>
        <P>unscripted is in beta. Features may change, break, or be removed, and the service may sometimes be unavailable. Your feedback shapes what comes next. Use &ldquo;Send feedback&rdquo; in the settings menu anytime.</P>

        <H>Who can use unscripted</H>
        <P>You must be 18 or older. You agree to give accurate account information, keep your password private, and use only your own account. You&rsquo;re responsible for activity on your account; tell us right away if you think someone else is using it.</P>

        <H>Your content</H>
        <P>You own what you write and post: posts, replies, chat messages, notes, and writing. By posting it on unscripted, you give us permission to store it, display it to the people it&rsquo;s shared with, and format it as needed to run the service. That permission ends when you delete the content or your account, except for copies other members have already saved or quoted in replies, and backups kept for a limited time.</P>
        <P>Only post content you have the right to share. Quoting short passages for discussion is part of book talk; please don&rsquo;t post whole chapters or other copyrighted works.</P>

        <H>Community guidelines</H>
        <P>unscripted is built for honest, thoughtful conversation, including disagreement. To keep it that way, you agree not to:</P>
        <UL>
          <li>Harass, threaten, bully, or intimidate anyone.</li>
          <li>Post hateful content that attacks people for who they are, including race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, or age.</li>
          <li>Share someone else&rsquo;s private information without their permission.</li>
          <li>Post sexually explicit content, or content that sexualizes minors in any way.</li>
          <li>Impersonate others, spam, or mislead people.</li>
          <li>Break the law, infringe others&rsquo; rights, or encourage anyone to do so.</li>
          <li>Interfere with the site, try to access accounts or data that aren&rsquo;t yours, or scrape the service.</li>
        </UL>

        <H>Clubs and hosts</H>
        <P>Club hosts can set their club&rsquo;s privacy, remove posts in their club, and remove members. Hosts are members too and must follow these terms. We may step in where a host can&rsquo;t or doesn&rsquo;t.</P>

        <H>Our role</H>
        <P>We may remove content or suspend or close accounts that break these terms or put members at risk, in our judgment. If you think we got something wrong, email us. You can stop using unscripted at any time and delete your account from Settings.</P>

        <H>Book information</H>
        <P>Book details and covers come partly from Open Library and may be incomplete or inaccurate. Recommendations, trending lists, and featured picks are for discovery, not endorsements.</P>

        <H>Disclaimers and limits</H>
        <P>unscripted is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, to the extent the law allows. We aren&rsquo;t responsible for what members post, and we can&rsquo;t promise the service will be uninterrupted or error-free, or that content will never be lost. To the extent the law allows, we aren&rsquo;t liable for indirect or consequential damages arising from your use of unscripted.</P>

        <H>Changes to these terms</H>
        <P>We may update these terms as unscripted grows. If changes are meaningful, we&rsquo;ll update the date above and let members know on the site or by email. Continuing to use unscripted after changes means you accept them.</P>

        <H>Governing law</H>
        <P>These terms are governed by the laws of the State of New York, without regard to its conflict-of-law rules, and any dispute will be handled in the state or federal courts located in New York, except where the law where you live gives you other rights.</P>

        <H>Contact</H>
        <P>Questions about these terms: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--tc)' }}>{CONTACT}</a></P>
      </div>
    </div>
  )
}
