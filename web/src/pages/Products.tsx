import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { at, calcWithGroup } from '../lib/calc'
import ProductCard from '../components/ProductCard'
import Icon, { Spinner } from '../components/Icon'
import Pager from '../components/Pager'

const PER_PAGE = 10

const SORTS: [string, string][] = [['d', 'Untung ↓'], ['a', 'Untung ↑'], ['n', 'A–Z']]

export default function Products() {
  const d = useData()
  const [q, setQ] = useState('')
  const [so, setSo] = useState('d')
  const [ct, setCt] = useState('')
  const [page, setPage] = useState(1)

  const cats = useMemo(() => [...new Set(d.products.map(p => p.category).filter((x): x is string => !!x))], [d.products])
  const list = useMemo(() => {
    const m = (p: (typeof d.products)[number]) => (p.sell_price > 0 ? at(calcWithGroup(p, d.products, d.groups), p.sell_price).untung : -1e9)
    return d.products
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()) && (!ct || p.category === ct))
      .sort((x, y) => (so === 'n' ? x.name.localeCompare(y.name) : so === 'a' ? m(x) - m(y) : m(y) - m(x)))
  }, [d.products, d.groups, q, so, ct])

  useEffect(() => { setPage(1) }, [q, so, ct])
  const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const cur = Math.min(page, pageCount)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)
  const go = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (d.loading) return <Spinner />
  if (d.error) return <div className="note bad">{d.error}</div>

  return (
    <>
      <div className="split" style={{ alignItems: 'center', marginBottom: 4 }}>
        <label className="search" style={{ marginBottom: 12 }}>
          <Icon n="search" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari produk" aria-label="Cari produk" />
        </label>
        <div className="seg" role="group" aria-label="Urutkan">
          {SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={so === k} onClick={() => setSo(k)}>{l}</button>)}
        </div>
      </div>
      {cats.length > 0 && (
        <div className="chips" role="group" aria-label="Kategori">
          <button type="button" className={`chip${!ct ? ' on' : ''}`} onClick={() => setCt('')}>Semua</button>
          {cats.map(c => <button type="button" key={c} className={`chip${ct === c ? ' on' : ''}`} onClick={() => setCt(c)}>{c}</button>)}
        </div>
      )}
      {list.length
        ? <>
            <div className="pgrid">{shown.map(p => <ProductCard key={p.id} p={p} />)}</div>
            <Pager page={cur} total={list.length} size={PER_PAGE} onPage={go} />
          </>
        : (
          <div className="card empty">
            <span className="ico c-green"><Icon n="box" /></span>
            <p>{d.products.length ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.'}</p>
            {!d.products.length && <Link className="btn" to="/kalkulator"><Icon n="plus" />Tambah produk</Link>}
          </div>
        )}
    </>
  )
}
