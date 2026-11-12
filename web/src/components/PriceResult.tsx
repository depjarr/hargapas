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
      Isi harga beli dan jumlah untuk melihat harga jual.
    </div>
  )

  const m = margins[pick] ?? 0
  const s = steps(c, m)
  const pr = tgt(c, m)
  const z = pr ? at(c, pr) : null
  const a = sell > 0 ? at(c, sell) : null

  // komponen total biaya produksi
  const parts: [string, number][] = [['harga beli / bahan baku', c.base]]
  if (c.fixed) parts.push(['biaya tetap', c.fixed])
  if (c.unit) parts.push(['biaya per unit', c.unit])

  return (
    <>
      <div className="kpis k3">
        <div className="kpi"><small>Total biaya produksi</small><b>{rp(c.total)}</b></div>
        <div className="kpi"><small>HPP / unit</small><b>{rp(c.hpp)}</b></div>
        <div className="kpi"><small>Jumlah dijual</small><b>{c.sq} unit</b></div>
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
          <small>per unit</small>
          <div className="meta">
            <span>Untung {rp(z.net)}/unit</span>
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
              {parts.length > 1 ? <>{parts.map(([, v]) => rp(v)).join(' + ')} = </> : null}
              <span className="res">{rp(c.total)}</span>
            </span>
            <small>{parts.map(([l]) => l).join(' + ')}</small>
          </div></li>
          <li><div>
            <b>HPP per unit</b>
            <span className="eq">{rp(c.total)} ÷ {c.sq} unit = <span className="res">{rp(c.hpp)}</span></span>
          </div></li>
          <li><div>
            <b>Harga jual (HJ)</b>
            <span className="eq">
              {rp(c.hpp)} + ({m}% × {rp(c.hpp)}) = {rp(c.hpp)} + {rp(s.laba)} = <span className="res">{rp(s.hj)}</span> per unit
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
          <div className="kpis" style={{ marginBottom: 0 }}>
            <div className="kpi flat"><small>Untung / unit</small><b className={a.net < 0 ? 'bad' : 'ok'}>{rp(a.net)}</b></div>
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
