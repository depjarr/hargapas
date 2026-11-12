export default function Bars({ rows, fmt }: { rows: [string, number][]; fmt: (n: number) => string }) {
  if (!rows.length) return <p className="mu">Belum ada data.</p>
  const mx = Math.max(1, ...rows.map(r => Math.abs(r[1])))
  return (
    <div className="bars">
      {rows.map(([n, v], i) => (
        <div className="b" key={i}>
          <span title={n}>{n}</span>
          <span className="track"><i className={v < 0 ? 'n' : ''} style={{ width: `${(Math.abs(v) / mx) * 100}%` }} /></span>
          <span>{fmt(v)}</span>
        </div>
      ))}
    </div>
  )
}
