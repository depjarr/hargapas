import Icon from './Icon'

/** Nomor halaman yang ditampilkan: semua kalau sedikit, kalau banyak pakai "…". */
function pages(cur: number, n: number): (number | '…')[] {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const s = new Set([1, n, cur - 1, cur, cur + 1].filter(x => x >= 1 && x <= n))
  const out: (number | '…')[] = []
  ;[...s].sort((a, b) => a - b).forEach((x, i, arr) => {
    if (i && x - arr[i - 1] > 1) out.push('…')
    out.push(x)
  })
  return out
}

export default function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const n = Math.ceil(total / size)
  if (n <= 1) return null
  const from = (page - 1) * size + 1
  const to = Math.min(total, page * size)
  return (
    <nav className="pager" aria-label="Halaman produk">
      <small>Menampilkan {from}–{to} dari {total}</small>
      <div className="pages">
        <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya"><Icon n="left" /></button>
        {pages(page, n).map((x, i) => x === '…'
          ? <span key={'e' + i} className="gap">…</span>
          : <button type="button" key={x} aria-current={x === page ? 'page' : undefined} onClick={() => onPage(x)}>{x}</button>)}
        <button type="button" disabled={page === n} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya"><Icon n="right" /></button>
      </div>
    </nav>
  )
}
