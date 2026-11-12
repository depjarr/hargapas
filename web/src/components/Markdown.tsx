import type { ReactNode } from 'react'

/** Format dalam baris: **tebal**, *miring*, `kode`. Aman: tidak memakai innerHTML. */
function inline(s: string, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0, m: RegExpExecArray | null, k = key
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**') || t.startsWith('__')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>)
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())

/** Markdown sederhana untuk jawaban AI: judul, daftar, tabel, paragraf. */
export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0, k = 0
  while (i < lines.length) {
    const l = lines[i]
    if (!l.trim()) { i++; continue }
    // tabel
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(l); i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]))
      blocks.push(
        <div className="md-table" key={k++}><table>
          <thead><tr>{head.map((h, j) => <th key={j}>{inline(h)}</th>)}</tr></thead>
          <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table></div>,
      )
      continue
    }
    // judul
    const h = l.match(/^\s*#{1,6}\s+(.*)$/)
    if (h) { blocks.push(<p className="md-h" key={k++}>{inline(h[1])}</p>); i++; continue }
    // garis
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { blocks.push(<hr key={k++} />); i++; continue }
    // daftar
    const ul = /^\s*[-*•]\s+/, ol = /^\s*\d+[.)]\s+/
    if (ul.test(l) || ol.test(l)) {
      const ordered = ol.test(l), re = ordered ? ol : ul
      const items: string[] = []
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''))
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(<Tag key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</Tag>)
      continue
    }
    // paragraf (gabung baris berurutan)
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !ul.test(lines[i]) && !ol.test(lines[i]) && !/^\s*(#|\|)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={k++}>{para.flatMap((t, j) => (j ? [<br key={'b' + j} />, ...inline(t, j * 100)] : inline(t)))}</p>)
  }
  return <div className="md">{blocks}</div>
}
