/**
 * Diagram peringkat: diurutkan dari terbesar, nama lengkap di atas, batang selebar penuh di bawah.
 * `share` = tampilkan persen bagian dari total (untuk angka yang bisa dijumlah, mis. total untung).
 */
export default function Bars({ rows, fmt, share = false }: { rows: [string, number][]; fmt: (n: number) => string; share?: boolean }) {
  if (!rows.length) return <p className="mu">Belum ada data.</p>
  const sorted = [...rows].sort((a, b) => b[1] - a[1])
  const mx = Math.max(1, ...sorted.map(r => Math.abs(r[1])))
  const sum = sorted.reduce((s, r) => s + Math.max(0, r[1]), 0)
  return (
    <ol className="rank">
      {sorted.map(([n, v], i) => (
        <li key={i} className={i === 0 && v > 0 ? 'top' : ''}>
          <div className="rk-head">
            <span className="rk-no">{i + 1}</span>
            <span className="rk-name">{n}</span>
            <span className="rk-val">
              <b className={v < 0 ? 'bad' : ''}>{fmt(v)}</b>
              {share && sum > 0 && v > 0 && <small>{Math.round((v / sum) * 100)}%</small>}
            </span>
          </div>
          <div className="rk-bar"><i className={v < 0 ? 'n' : ''} style={{ width: `${Math.max(2, (Math.abs(v) / mx) * 100)}%` }} /></div>
        </li>
      ))}
    </ol>
  )
}
