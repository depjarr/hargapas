import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { at, calcWithGroup } from '../lib/calc'
import { dt, pc, rp } from '../lib/format'
import Bars from '../components/Bars'
import { tone } from '../components/ProductCard'
import ProductCarousel from '../components/ProductCarousel'
import Icon, { Spinner } from '../components/Icon'
import { NAV } from '../components/Layout'

export default function Dashboard() {
  const d = useData()
  const m = useMemo(() => {
    const all = d.products.map(p => ({ p, c: calcWithGroup(p, d.products, d.groups) }))
    const A = all.filter(x => x.p.sell_price > 0).map(x => ({ ...x, a: at(x.c, x.p.sell_price) })).sort((x, y) => y.a.untung - x.a.untung)
    return {
      A,
      cap: all.reduce((s, x) => s + x.c.total, 0),
      profit: A.reduce((s, x) => s + x.a.total, 0),
      avg: A.length ? A.reduce((s, x) => s + x.a.untung, 0) / A.length : 0,
      low: A.filter(x => x.a.untung < 10),
      recent: d.products.flatMap(p => p.price_history.map(h => ({ ...h, n: p.name }))).sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)).slice(0, 5),
    }
  }, [d.products, d.groups])

  if (d.loading) return <Spinner />
  if (d.error) return <div className="note bad">{d.error}</div>

  return (
    <>
      <div className="tiles">
        {NAV.slice(1).map(([to, icon, , title, , color]) => (
          <Link key={to} to={to} className="tile">
            <span className={`ico c-${color}`}><Icon n={icon} /></span>{title}
          </Link>
        ))}
      </div>

      <div className="sec-h"><h2>Ringkasan</h2></div>
      <div className="kpis">
        <div className="kpi"><small>Total produk</small><b>{d.products.length}</b></div>
        <div className="kpi"><small>Total modal</small><b>{rp(m.cap)}</b></div>
        <div className="kpi"><small>Estimasi untung</small><b className={m.profit < 0 ? 'bad' : 'ok'}>{rp(m.profit)}</b></div>
        <div className="kpi"><small>Rata-rata untung</small><b>{pc(m.avg)}</b></div>
      </div>

      <div className="sec-h"><h2>Produk Saya</h2><Link to="/produk">Lihat semua</Link></div>
      {d.products.length ? (
        <ProductCarousel items={d.products.slice(0, 10)} />
      ) : (
        <div className="card empty">
          <span className="ico c-green"><Icon n="box" /></span>
          <p>Belum ada produk.</p>
          <Link className="btn" to="/kalkulator"><Icon n="plus" />Hitung produk pertama</Link>
        </div>
      )}

      <div className="grid g2" style={{ marginTop: 22 }}>
        <div className="card">
          <h2>Untung per produk</h2>
          <small>Persen untung dari modal (HPP)</small>
          <Bars rows={m.A.map(x => [x.p.name, x.a.untung])} fmt={pc} />
        </div>
        <div>
          <div className="cap" style={{ marginTop: 0 }}>Paling menguntungkan</div>
          <div className="group">
            {m.A.slice(0, 3).map(x => (
              <Link key={x.p.id} to={`/produk/${x.p.id}`} className="li">
                <span className="grow">{x.p.name}</span><span className={`pill ${tone(x.a.untung)}`}>{pc(x.a.untung)}</span>
              </Link>
            ))}
            {!m.A.length && <div className="li mu">Belum ada.</div>}
          </div>
          <div className="cap">Untung rendah (&lt; 10%)</div>
          <div className="group">
            {m.low.map(x => (
              <Link key={x.p.id} to={`/rekomendasi?p=${x.p.id}`} className="li">
                <span className="grow">{x.p.name}</span><span className="pill bad">{pc(x.a.untung)}</span>
              </Link>
            ))}
            {!m.low.length && <div className="li mu">Tidak ada. Bagus!</div>}
          </div>
        </div>
      </div>

      <div className="cap">Perhitungan terbaru</div>
      <div className="group">
        {m.recent.map(h => (
          <div key={h.id} className="li">
            <span className="ico sm c-blue"><Icon n="calc" /></span>
            <span className="grow"><b style={{ fontWeight: 600 }}>{h.n}</b><br /><small>{dt(h.created_at)}</small></span>
            <span className="val">{rp(h.price)}</span>
          </div>
        ))}
        {!m.recent.length && <div className="li mu">Simpan produk untuk melihat riwayat.</div>}
      </div>
    </>
  )
}
