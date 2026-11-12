import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { must, useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { at, calcWithGroup, groupInfo, NM, steps } from '../lib/calc'
import { pc, rp } from '../lib/format'
import ConfirmButton from '../components/ConfirmButton'
import Icon, { Spinner } from '../components/Icon'
import { tone } from '../components/ProductCard'

export default function ProductDetail() {
  const { id } = useParams()
  const d = useData()
  const nav = useNavigate()
  const toast = useToast()
  const p = d.products.find(x => x.id === id)

  if (d.loading) return <Spinner />
  if (!p) return <div className="note bad">Produk tidak ditemukan. <Link to="/produk">Kembali</Link></div>

  const c = calcWithGroup(p, d.products, d.groups)
  const gi = groupInfo(p, d.products, d.groups)
  const sq = c.sq, q = +p.qty || 0, f = c.pct
  const img = p.image_path ? d.images[p.image_path] : ''

  const R: [string, string, string, number][] = [[`${p.name} (harga beli)`, p.pd ?? '', `${rp(p.purchase_price)} × ${q} pcs`, c.base]]
  p.product_costs.forEach(x => {
    const v = +x.value || 0
    if (x.type === 'fixed') R.push([x.name, x.note ?? '', `${rp(v)} (total)`, v])
    else if (x.type === 'unit') R.push([x.name, x.note ?? '', `${rp(v)} × ${sq} pcs`, v * sq])
  })
  gi?.g.items.forEach(x => R.push([`${x.name} (bersama, grup ${gi.g.name})`, x.note ?? '', `${rp(x.value)} ÷ ${gi.M} pcs × ${sq} pcs`, ((+x.value || 0) / gi.M) * sq]))
  const pcs = p.product_costs.filter(x => x.type === 'pct')
  const mem = p.group_id ? d.products.filter(x => x.group_id === p.group_id) : []
  const a = p.sell_price > 0 ? at(c, p.sell_price) : null

  async function remove() {
    try {
      must(await supabase.from('products').delete().eq('id', p!.id))
      if (p!.image_path) await supabase.storage.from('product-images').remove([p!.image_path])
      await d.reload()
      toast('Produk dihapus')
      nav('/produk')
    } catch (e) { toast(e instanceof Error ? e.message : 'Gagal menghapus.', true) }
  }

  return (
    <>
      <Link className="btn ghost sm" to="/produk" style={{ paddingLeft: 0 }}><Icon n="left" />Produk Saya</Link>

      <section className="pd">
        <div className="pd-media">
          {img ? (
            <a href={img} target="_blank" rel="noreferrer" aria-label="Buka gambar ukuran penuh">
              <img className="blur" src={img} alt="" aria-hidden />
              <img className="main" src={img} alt={p.name} />
            </a>
          ) : <span className="init">{p.name[0]?.toUpperCase()}</span>}
        </div>

        <div className="pd-info">
          <span className="eyebrow">{p.category || 'Tanpa kategori'}</span>
          <h1>{p.name}</h1>
          {p.sell_price > 0 ? (
            <div className="pd-price">
              <span>{rp(p.sell_price)}</span>
              {a && <span className={`pill ${tone(a.untung)}`}>untung {pc(a.untung)}</span>}
            </div>
          ) : <p className="mu">Harga jual belum diatur.</p>}
          {p.notes && <p className="mu">{p.notes}</p>}

          <ul className="feats">
            <li><span className="ico sm c-blue"><Icon n="calc" /></span>HPP {rp(c.hpp)} per pcs</li>
            {a && <li><span className="ico sm c-green"><Icon n="trend" /></span>Untung {rp(a.net)} per pcs</li>}
            <li><span className="ico sm c-orange"><Icon n="box" /></span>{q} pcs dibeli, {sq} pcs bisa dijual</li>
            <li><span className="ico sm c-purple"><Icon n="layers" /></span>{gi ? `Grup varian ${gi.g.name}` : 'Tanpa grup varian'}</li>
          </ul>

          <div className="pd-actions">
            <Link className="btn block" to={`/kalkulator/${p.id}`}><Icon n="edit" />Ubah produk</Link>
            <Link className="btn block soft" to={`/rekomendasi?p=${p.id}`}><Icon n="bulb" />Rekomendasi harga</Link>
            <ConfirmButton className="btn block danger" onConfirm={remove}>Hapus produk</ConfirmButton>
          </div>
        </div>
      </section>

      <div className="strip">
        <div><span className="ico sm c-blue"><Icon n="wallet" /></span><span><b>{rp(c.total)}</b><small>Total biaya produksi</small></span></div>
        <div><span className="ico sm c-orange"><Icon n="calc" /></span><span><b>{rp(c.hpp)}</b><small>HPP per pcs</small></span></div>
        <div><span className="ico sm c-green"><Icon n="trend" /></span><span><b className={a && a.net < 0 ? 'bad' : ''}>{a ? rp(a.net) : '-'}</b><small>Untung per pcs</small></span></div>
        <div><span className="ico sm c-purple"><Icon n="chart" /></span><span><b className={a && a.net < 0 ? 'bad' : ''}>{a ? rp(a.total) : '-'}</b><small>Total untung ({sq} pcs)</small></span></div>
      </div>

      <div className="card">
        <h2>1. Total biaya produksi</h2>
        <div className="scroll"><table>
          <thead><tr><th>Item</th><th>Rumus</th><th>Total</th><th>Per pcs</th></tr></thead>
          <tbody>
            {R.map((r, i) => (
              <tr key={i}><td>{r[0]}{r[1] && <><br /><small>{r[1]}</small></>}</td><td>{r[2]}</td><td>{rp(r[3])}</td><td>{rp(r[3] / sq)}</td></tr>
            ))}
            <tr><th>Total biaya produksi</th><th>jumlah semua baris</th><th>{rp(c.total)}</th><th>{rp(c.hpp)}</th></tr>
          </tbody>
        </table></div>
        <p style={{ marginTop: 12 }}><b>2. HPP per pcs</b> = total biaya ÷ jumlah bisa dijual = {rp(c.total)} ÷ {sq} = <b>{rp(c.hpp)}</b></p>
        {pcs.length > 0 && (
          <div className="note info" style={{ marginTop: 12, marginBottom: 0 }}>
            <b>Biaya persen</b> (tidak masuk modal, dipotong dari harga jual):{' '}
            {pcs.map(x => `${x.name} ${x.value}%`).join(', ')} · total {pc(f * 100)}
          </div>
        )}
      </div>

      <div className="card">
        <h2>3. Harga jual yang disarankan</h2>
        <small>Rumus: HJ = HPP + (target untung % × HPP){f > 0 ? `, lalu ÷ (1 − ${pc(f * 100)}) untuk menutup biaya persen` : ''}</small>
        <div className="scroll" style={{ marginTop: 8 }}><table>
          <thead><tr><th>Strategi</th><th>Perhitungan</th><th>Harga jual</th><th>Untung/pcs</th></tr></thead>
          <tbody>
            {NM.map((n, i) => {
              const m = d.margins[i], s = steps(c, m)
              if (!s.final) return <tr key={n}><td>{n}</td><td colSpan={3} className="bad">Tidak bisa dihitung</td></tr>
              const z = at(c, s.final)
              return (
                <tr key={n}>
                  <td>{n} ({m}%)</td>
                  <td>{rp(c.hpp)} + ({m}% × {rp(c.hpp)}) = {rp(s.hj)}{f > 0 ? ` ÷ (1 − ${pc(f * 100)})` : ''}</td>
                  <td><b>{rp(s.final)}</b></td>
                  <td className="ok">{rp(z.net)}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        <p className="mu" style={{ marginTop: 8, marginBottom: 0 }}>Harga impas (tanpa untung): {rp(c.breakEven)}</p>
      </div>

      {a && (
        <>
          <div className="card">
            <h2>4. Untung di harga {rp(p.sell_price)}</h2>
            <div className="group" style={{ boxShadow: 'none', background: 'var(--fill-2)' }}>
              <div className="li"><span className="grow">Laba kotor (harga − HPP)</span><span className="val">{rp(a.gross)}</span></div>
              <div className="li"><span className="grow">Biaya persen ({pc(f * 100)})</span><span className="val">− {rp(a.fee)}</span></div>
              <div className="li"><span className="grow"><b>Untung bersih / pcs</b></span><b className={a.net < 0 ? 'bad' : 'ok'}>{rp(a.net)}</b></div>
              <div className="li"><span className="grow">Untung dari modal (÷ HPP)</span><span className="val">{pc(a.untung)}</span></div>
              <div className="li"><span className="grow">Laba dari harga jual (÷ harga)</span><span className="val">{pc(a.margin)}</span></div>
              <div className="li"><span className="grow"><b>Total untung</b> ({sq} pcs)</span><b className={a.net < 0 ? 'bad' : 'ok'}>{rp(a.total)}</b></div>
            </div>
          </div>
          <div className="card">
            <h2>5. Kalau diberi diskon</h2>
            <div className="scroll"><table>
              <thead><tr><th>Diskon</th><th>Harga</th><th>Untung/pcs</th><th>Untung %</th><th>Total untung</th></tr></thead>
              <tbody>
                {[0, 5, 10, 15, 20].map(x => {
                  const pr = p.sell_price * (1 - x / 100), z = at(c, pr)
                  return <tr key={x}><td>{x}%</td><td>{rp(pr)}</td><td className={z.net < 0 ? 'bad' : 'ok'}>{rp(z.net)}</td><td>{pc(z.untung)}</td><td>{rp(z.total)}</td></tr>
                })}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {mem.length > 1 && (
        <div className="card">
          <h2>Ringkasan grup {gi?.g.name}</h2>
          <div className="scroll"><table>
            <thead><tr><th>Varian</th><th>Jumlah</th><th>Modal</th><th>HPP</th><th>Total untung</th></tr></thead>
            <tbody>
              {mem.map(m => {
                const k = calcWithGroup(m, d.products, d.groups)
                const z = m.sell_price > 0 ? at(k, m.sell_price) : null
                return <tr key={m.id}><td>{m.name}</td><td>{k.sq}</td><td>{rp(k.total)}</td><td>{rp(k.hpp)}</td><td>{z ? rp(z.total) : '-'}</td></tr>
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  )
}
