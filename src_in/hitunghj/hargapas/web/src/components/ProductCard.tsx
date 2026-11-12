import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { at, calcWithGroup } from '../lib/calc'
import { pc, rp } from '../lib/format'
import type { Product } from '../lib/types'

/** Warna label untung: merah < 10%, oranye < 25%, hijau selebihnya. */
export const tone = (u: number) => (u < 10 ? 'bad' : u < 25 ? 'warn' : 'ok')

/** Kartu produk bergambar besar (dipakai di halaman Produk Saya). */
export default function ProductCard({ p }: { p: Product }) {
  const d = useData()
  const c = calcWithGroup(p, d.products, d.groups)
  const a = p.sell_price > 0 ? at(c, p.sell_price) : null
  const img = p.image_path ? d.images[p.image_path] : ''
  return (
    <Link to={`/produk/${p.id}`} className="ptile">
      <span className="pimg">
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="init">{(p.name || '?')[0].toUpperCase()}</span>}
        {a && <span className={`pill ${tone(a.untung)}`}>{pc(a.untung)}</span>}
      </span>
      <span className="pbody">
        <small>{p.category || 'Tanpa kategori'}</small>
        <b>{p.name}</b>
        {p.sell_price > 0 ? <span className="price">{rp(p.sell_price)}</span> : <small>Harga belum diatur</small>}
        <small>HPP {rp(c.hpp)}{a ? ` · untung ${rp(a.net)}/pcs` : ''}</small>
      </span>
    </Link>
  )
}
