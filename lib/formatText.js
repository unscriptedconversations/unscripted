// lib/formatText.js
// Light formatting for writing, shared by the editor preview and the reading page.
// Builds React elements only (never raw HTML), so readers can't inject markup.
//
//   **bold**    *italic* or _italic_    [link text](https://example.com)
//   ## Heading  ### Smaller heading   (a line on its own)
//   > Quoted passage     (every line of the paragraph starting with >)
//   ---                  (a line on its own: section break)
// Blank lines separate paragraphs; single line breaks stay inside them.
import React from 'react'

const h = React.createElement

// Inline: links, bold, italic. Anything unmatched stays as plain text.
// Markers must hug the text ("*word*", not "2 * 3"), so arithmetic stays plain.
const INLINE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*|\*([^*\s](?:[^*\n]*[^*\s])?)\*|(^|[^\w])_([^_\s](?:[^_\n]*[^_\s])?)_(?=[^\w]|$)/g

function inline(text, keyBase) {
  const out = []
  let last = 0, m, k = 0
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    let start = m.index
    let lead = ''
    if (m[6] !== undefined) { lead = m[5] || ''; start += lead.length }
    if (start > last || lead) out.push(text.slice(last, start))
    const key = `${keyBase}-${k++}`
    if (m[1] !== undefined) out.push(h('a', { key, href: m[2], target: '_blank', rel: 'noopener noreferrer nofollow', style: { color: 'var(--tc)', textDecoration: 'underline', textUnderlineOffset: 3 } }, m[1]))
    else if (m[3] !== undefined) out.push(h('strong', { key, style: { fontWeight: 700 } }, m[3]))
    else if (m[4] !== undefined) out.push(h('em', { key }, m[4]))
    else out.push(h('em', { key }, m[6]))
    last = INLINE.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Full text -> array of block elements
export function renderRich(text) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return blocks.map((b, i) => {
    const key = `b${i}`
    if (/^-{3,}$/.test(b)) return h('div', { key, role: 'separator', style: { textAlign: 'center', margin: '1.6em 0', letterSpacing: '0.6em', color: 'var(--txD)' } }, '\u2022\u2022\u2022')
    const hm = b.match(/^(#{1,3})\s+(.+)$/)
    if (hm && !b.includes('\n')) return h(hm[1].length <= 2 ? 'h2' : 'h3', { key, style: { fontFamily: 'var(--hd)', fontSize: hm[1].length <= 2 ? '1.45em' : '1.2em', fontWeight: 600, lineHeight: 1.25, margin: '1.4em 0 0.5em' } }, inline(hm[2], key))
    const lines = b.split('\n')
    if (lines.every(l => /^>\s?/.test(l))) {
      return h('blockquote', { key, style: { margin: '0 0 1.15em', padding: '0 0 0 18px', borderLeft: '3px solid var(--tc)', fontStyle: 'italic', color: 'var(--txD)', whiteSpace: 'pre-wrap' } }, inline(lines.map(l => l.replace(/^>\s?/, '')).join('\n'), key))
    }
    return h('p', { key, style: { margin: '0 0 1.15em', whiteSpace: 'pre-wrap' } }, inline(b, key))
  })
}

// Text with the markers removed, for excerpts and previews
export function plainText(text) {
  return String(text || '')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*/g, '$1')
    .replace(/\*([^*\s](?:[^*\n]*[^*\s])?)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\s](?:[^_\n]*[^_\s])?)_(?=[^\w]|$)/g, '$1$2')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-{3,}$/gm, '')
}
