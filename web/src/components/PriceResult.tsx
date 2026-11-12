import { useState } from 'react'
import { at, NM, steps, tgt, type Calc } from '../lib/calc'
import { pc, rp } from '../lib/format'
import Icon from './Icon'

/** Hasil hitung: total biaya, HPP, harga jual per strategi + cara menghitungnya langkah demi langkah. */
export default function PriceResult({ c, sell, margins, onUse }:
  { c: Calc; sell: number; margins: number[]; onUse: (price: number) => void }) {
  const [pick, setPick] = useState(1)
  if (!c.hpp) return (
    <div className="card empty">
      <span className="ico c-orange"><Icon n="calc" /></span>
      Isi biaya bahan baku, jumlah produk, dan biaya operasional untuk melihat harga jual.
    </div>
  )

  const m = margins[pick] ?? 0
  const s = steps(c, m)
  const pr = tgt(c, m)
  const z = pr ? at(c, pr) : null
  const a = sell > 0 ? at(c, sell) : null

  // 1. Total biaya produksi = bahan baku + operasional/tenaga kerja + bagian biaya bersama grup
  const parts: [string, number][] = [['bahan baku', c.bahan], ['operasional / tenaga kerja', c.ops]]
  if (c.share) parts.push(['biaya bersama grup', c.share])

  return (
    <>
      <div className="kpis k3">
        <div className="kpi"><small>Total biaya produksi</small><b>{rp(c.total)}</b></div>
        <div className="kpi"><small>HPP / produk</small><b>{rp(c.hpp)}</b></div>
        <div className="kpi"><small>Jumlah produk</small><b>{c.sq}</b></div>
      </div>

      <div className="seg" role="group" aria-label="Pilih strategi harga">
        {NM.map((n, i) => (
          <button key={n} type="button" aria-pressed={pick === i} onClick={() => setPick(i)}>
            {n}<small>untung {margins[i]}%</small>
          </button>
        ))}
      </div>

      {pr && z ? (
        <div className="pricehero">
          <small>Harga jual disarankan · {NM[pick]}</small>
          <span className="big">{rp(pr)}</span>
          <small>per produk</small>
          <div className="meta">
            <span>Untung {rp(z.net)}/produk</span>
            <span>{pc(z.untung)} dari modal</span>
            <span>Total {rp(z.total)}</span>
          </div>
          <button type="button" className="btn white sm" onClick={() => onUse(pr)}>Pakai harga ini</button>
        </div>
      ) : (
        <div className="note bad">Biaya persen ≥ 100%, harga tidak bisa dihitung. Kurangi biaya persen.</div>
      )}

      <div className="card">
        <h2>Cara menghitungnya</h2>
        <ol className="steps">
          <li><div>
            <b>Total biaya produksi</b>
            <span className="eq">
              {parts.map(([, v]) => rp(v)).join(' + ')} ={' '}
              <span className="res">{rp(c.total)}</span>
            </span>
            <small>{parts.map(([l]) => l).join(' + ')}</small>
          </div></li>
          <li><div>
            <b>HPP per produk</b>
            <span className="eq">{rp(c.total)} ÷ {c.sq} produk = <span className="res">{rp(c.hpp)}</span></span>
          </div></li>
          <li><div>
            <b>Harga jual (HJ)</b>
            <span className="eq">
              {rp(c.hpp)} + ({m}% × {rp(c.hpp)}) = {rp(c.hpp)} + {rp(s.laba)} = <span className="res">{rp(s.hj)}</span> per produk
            </span>
          </div></li>
          {c.pct > 0 && (
            <li><div>
              <b>Tambah biaya persen {pc(c.pct * 100)}</b>
              <span className="eq">{rp(s.hj)} ÷ (1 − {pc(c.pct * 100)}) = <span className="res">{rp(s.final)}</span></span>
              <small>Admin marketplace / biaya pembayaran dipotong dari harga jual, jadi harga dinaikkan supaya untung {m}% tetap utuh.</small>
            </div></li>
          )}
        </ol>
      </div>

      {a && (
        <div className="card">
          <h2>Kalau dijual {rp(sell)}</h2>
          <div className="kpis k2" style={{ marginBottom: 0 }}>
            <div className="kpi flat"><small>Untung / produk</small><b className={a.net < 0 ? 'bad' : 'ok'}>{rp(a.net)}</b></div>
            <div className="kpi flat"><small>Untung dari modal</small><b>{pc(a.untung)}</b></div>
            <div className="kpi flat"><small>Biaya persen</small><b>{rp(a.fee)}</b></div>
            <div className="kpi flat"><small>Total untung</small><b className={a.net < 0 ? 'bad' : 'ok'}>{rp(a.total)}</b></div>
          </div>
          {a.net < 0 && <p className="bad" style={{ marginTop: 12 }}>Harga ini membuat rugi. Naikkan harga atau kurangi biaya.</p>}
        </div>
      )}
    </>
  )
}
