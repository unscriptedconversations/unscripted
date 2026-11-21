// Post tag pill. Colors for community/reflection/book live in globals.css;
// "announcement" (club emails posted to the feed) is styled here.
const ANNOUNCEMENT = { background: 'rgba(212,160,60,0.16)', color: '#8A5A12' }

export default function Tag({ tag }) {
  return (
    <span className={`tag tag-${tag}`} style={tag === 'announcement' ? ANNOUNCEMENT : undefined}>
      {tag === 'announcement' ? '📣 announcement' : tag}
    </span>
  )
}
