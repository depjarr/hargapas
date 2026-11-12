import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { at, calcWithGroup } from '../lib/calc'
import { pc, rp } from '../lib/format'
import type { Product } from '../lib/types'
import Icon from './Icon'
import { tone } from './ProductCard'

/** Carousel produk unggulan: geser di HP, drag atau tombol panah di laptop. Kartu tengah dibesarkan. */
export default function ProductCarousel({ items }: { items: Product[] }) {
  const d = useData()
  const box = useRef<HTMLDivElement>(null)
  const [act, setAct] = useState(0)
  const drag = useRef({ on: false, x: 0, left: 0, moved: 0 })
  const raf = useRef(0)
  const lock = useRef<number | null>(null)   // tujuan saat sedang animasi geser

  const cards = () => Array.from(box.current?.children ?? []) as HTMLElement[]
  const go = useCallback((i: number, smooth = true) => {
    const el = box.current, c = cards()[i]
    if (!el || !c) return
    const left = c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2
    setAct(i)
    lock.current = smooth && Math.abs(el.scrollLeft - left) > 2 ? i : null   // tidak dikunci kalau sudah di posisi
    el.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const nearest = () => {
    const el = box.current
    if (!el) return 0
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0, dist = Infinity
    cards().forEach((c, i) => { const m = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (m < dist) { dist = m; best = i } })
    return best
  }
  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const n = nearest()
      if (lock.current != null) { if (n === lock.current) lock.current = null; return }
      setAct(n)
    })
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  useEffect(() => { go(0, false); lock.current = null }, [items.length, go])

  // drag pakai mouse (sentuhan di HP sudah otomatis bisa digeser)
  const down = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !box.current) return
    lock.current = null
    drag.current = { on: true, x: e.clientX, left: box.current.scrollLeft, moved: 0 }
    box.current.classList.add('dragging')
  }
  const move = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g.on || !box.current) return
    g.moved = Math.max(g.moved, Math.abs(e.clientX - g.x))
    box.current.scrollLeft = g.left - (e.clientX - g.x)
  }
  const up = () => {
    if (!drag.current.on || !box.current) return
    drag.current.on = false
    box.current.classList.remove('dragging')
    go(nearest())
  }

  if (!items.length) return null
  return (
    <div className="carousel">
      <div className="car" ref={box} onScroll={onScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        onClickCapture={e => { if (drag.current.moved > 6) { e.preventDefault(); e.stopPropagation(); drag.current.moved = 0 } }}>
        {items.map((p, i) => {
          const c = calcWithGroup(p, d.products, d.groups)
          const a = p.sell_price > 0 ? at(c, p.sell_price) : null
          const img = p.image_path ? d.images[p.image_path] : ''
          return (
            <Link key={p.id} to={`/produk/${p.id}`} className={`fcard${i === act ? ' on' : ''}`} draggable={false} aria-label={p.name}>
              <span className="fimg">
                {img ? <img src={img} alt="" draggable={false} /> : <span className="init">{(p.name || '?')[0].toUpperCase()}</span>}
                <span className="ftag">{p.category || 'Produk'}</span>
              </span>
              <span className="frow"><b>{p.name}</b>{p.sell_price > 0 && <span className="price">{rp(p.sell_price)}</span>}</span>
              <small>HPP {rp(c.hpp)}{a && <> · <span className={`pill ${tone(a.untung)}`}>untung {pc(a.untung)}</span></>}</small>
            </Link>
          )
        })}
      </div>
      <button type="button" className="arrow prev" onClick={() => go(Math.max(0, act - 1))} disabled={act === 0} aria-label="Produk sebelumnya"><Icon n="left" /></button>
      <button type="button" className="arrow next" onClick={() => go(Math.min(items.length - 1, act + 1))} disabled={act === items.length - 1} aria-label="Produk berikutnya"><Icon n="right" /></button>
      <div className="dots">
        {items.map((p, i) => <button type="button" key={p.id} aria-label={`Ke produk ${i + 1}`} aria-current={i === act} onClick={() => go(i)} />)}
      </div>
    </div>
  )
}
