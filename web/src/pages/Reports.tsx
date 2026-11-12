import { useMemo } from 'react'
import { useData } from '../lib/data'
import { at, calcWithGroup } from '../lib/calc'
import { dd, pc, rp } from '../lib/format'
import Bars from '../components/Bars'
import Icon, { Spinner } from '../components/Icon'

export default function Reports() {
  const d = useData()
  const A = useMemo(() => d.products.filter(p => p.sell_price > 0).map(p => ({ p, a: at(calcWithGroup(p, d.products, d.groups), p.sell_price) })), [d.products, d.groups])
  const cats = useMemo(() => {
    const m: Record<string, number> = {}
    A.forEach(x => { const k = x.p.category || 'Tanpa kategori'; m[k] = (m[k] || 0) + x.a.total })
    return Object.entries(m)
  }, [A])
  const hist = useMemo(() => d.products.flatMap(p => p.price_history.map(h => ({ ...h, n: p.name }))).sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)), [d.products])

  if (d.loading) return <Spinner />
  if (d.error) return <div className="note bad">{d.error}</div>

  function csv() {
    const cell = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"'
    const rows: (string | number)[][] = [['Produk', 'Kategori', 'Total biaya produksi', 'HPP', 'Harga jual', 'Untung/unit', 'Untung % (dari HPP)']]
    d.products.forEach(p => {
      const c = calcWithGroup(p, d.products, d.groups)
      const a = p.sell_price > 0 ? at(c, p.sell_price) : null
      rows.push([p.name, p.category ?? '', Math.round(c.total), Math.round(c.hpp), p.sell_price || '', a ? Math.round(a.net) : '', a ? a.untung.toFixed(2) : ''])
    })
    const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const el = document.createElement('a')
    el.href = URL.createObjectURL(blob)
    el.download = 'laporan-harga.csv'
    el.click()
    URL.revokeObjectURL(el.href)
  }

  return (
    <>
      <div className="row end" style={{ marginBottom: 12 }}>
        <button className="btn sm soft" onClick={csv} disabled={!d.products.length}><Icon n="download" />Unduh CSV</button>
      </div>
      <div className="grid g2">
        <div className="card"><h2>Total untung per produk</h2><small>Untung per produk × jumlah produk, diurutkan dari terbesar</small><Bars share rows={A.map(x => [x.p.name, x.a.total])} fmt={rp} /></div>
        <div className="card"><h2>Untung per kategori</h2><small>Jumlah total untung semua produk di tiap kategori</small><Bars share rows={cats} fmt={rp} /></div>
      </div>
      <div className="card">
        <h2>Riwayat perhitungan</h2>
        {hist.length === 0 ? <p className="mu">Simpan produk untuk melihat riwayat.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Tanggal</th><th>Produk</th><th>Harga jual</th><th>Untung/unit</th><th>Untung %</th></tr></thead>
            <tbody>
              {hist.map(h => (
                <tr key={h.id}><td>{dd(h.created_at)}</td><td>{h.n}</td><td>{rp(h.price)}</td><td>{h.net != null ? rp(h.net) : '-'}</td><td>{h.margin != null ? pc(h.margin) : '-'}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  )
}
