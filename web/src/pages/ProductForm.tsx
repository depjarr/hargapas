import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { must, useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { at, calcWithGroup, groupInfo, lineTotal } from '../lib/calc'
import { rp, today } from '../lib/format'
import { resizeImage } from '../lib/image'
import { PIN_BASE, PIN_GROUP, PIN_PRODUCTS } from '../lib/sample'
import PriceResult from '../components/PriceResult'
import MarginInputs from '../components/MarginInputs'
import CostTypePicker from '../components/CostTypePicker'
import Icon, { Spinner } from '../components/Icon'
import type { CostCategory, CostType, Group, Product } from '../lib/types'

interface Form { name: string; cat: string; qty: string; supplier: string; date: string; notes: string; pd: string; sell: string; grp: string }
interface CostRow { n: string; t: CostType; v: string; d?: string; k: CostCategory }
interface GRow { n: string; v: string; d?: string }
const blank = (): Form => ({ name: '', cat: '', qty: '', supplier: '', date: today(), notes: '', pd: '', sell: '', grp: '' })
const FIELDS: [keyof Form, string, string][] = [
  ['name', 'Nama produk', 'text'], ['cat', 'Kategori', 'text'], ['qty', 'Jumlah produk / porsi', 'number'],
  ['supplier', 'Pemasok', 'text'], ['date', 'Tanggal produksi', 'date'],
]
const PH: Partial<Record<keyof Form, string>> = { name: 'Wajib', cat: 'Opsional', qty: 'mis. 50', supplier: 'Opsional' }
const TYPE_LABEL: Record<CostType, string> = { fixed: 'Total', unit: 'Per produk', pct: 'Persen (%)' }
const SECTIONS: { k: CostCategory; title: string; empty: string; hint: string; types: CostType[]; color: string; icon: string }[] = [
  {
    k: 'bahan', title: 'Bahan baku', color: 'orange', icon: 'box', types: ['fixed', 'unit'],
    empty: 'Belum ada bahan baku. Contoh: teh, gula, es, gelas.',
    hint: 'Total = harga semua bahan untuk seluruh produk (mis. Rp150.000). Per produk = harga per 1 produk, dikali jumlah produk otomatis.',
  },
  {
    k: 'operasional', title: 'Operasional / tenaga kerja', color: 'purple', icon: 'user', types: ['fixed', 'unit', 'pct'],
    empty: 'Belum ada biaya operasional. Contoh: tenaga kerja & listrik.',
    hint: 'Total = untuk seluruh produk (mis. tenaga kerja & listrik Rp100.000). Persen = dipotong dari harga jual (mis. admin marketplace 8%), tidak masuk total biaya produksi.',
  },
]

export default function ProductForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const d = useData()
  const existing = useMemo(() => d.products.find(p => p.id === id), [d.products, id])

  const [f, setF] = useState<Form>(blank())
  const [costs, setCosts] = useState<CostRow[]>([])
  const [gItems, setGItems] = useState<GRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dropImg, setDropImg] = useState(false)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const loaded = useRef(false)
  const gKey = useRef('')

  const gName = f.grp.trim()
  const match = d.groups.find(g => g.name.toLowerCase() === gName.toLowerCase())

  function reset() {
    setF(blank()); setCosts([]); setGItems([]); setFile(null); setDropImg(false); gKey.current = ''
  }
  function commitGroup(name: string) {
    const n = name.trim()
    const m = d.groups.find(g => g.name.toLowerCase() === n.toLowerCase())
    const key = n ? (m ? m.id : 'new:' + n.toLowerCase()) : ''
    if (key === gKey.current) return
    gKey.current = key
    setGItems(m ? m.items.map(i => ({ n: i.name, v: String(i.value), d: i.note ?? undefined })) : [])
  }

  useEffect(() => { loaded.current = false; if (!id) reset() }, [id])

  // isi form saat ubah produk
  useEffect(() => {
    if (!id || !existing || loaded.current) return
    loaded.current = true
    const g = d.groups.find(x => x.id === existing.group_id)
    setF({
      name: existing.name, cat: existing.category ?? '', qty: String(existing.qty || ''),
      supplier: existing.supplier ?? '', date: existing.purchased_at ?? today(), notes: existing.notes ?? '', pd: existing.pd ?? '',
      sell: existing.sell_price ? String(existing.sell_price) : '', grp: g?.name ?? '',
    })
    setCosts(existing.product_costs.map(c => ({ n: c.name, t: c.type, v: String(c.value), d: c.note ?? undefined, k: c.category })))
    setGItems(g ? g.items.map(i => ({ n: i.name, v: String(i.value), d: i.note ?? undefined })) : [])
    gKey.current = g ? g.id : ''
    setFile(null); setDropImg(false)
  }, [id, existing, d.groups])

  useEffect(() => {
    if (!file) return setPreview('')
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  const setCost = (i: number, p: Partial<CostRow>) => setCosts(cs => cs.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const addCost = (k: CostCategory, row?: Partial<CostRow>) => setCosts(cs => [...cs, { n: '', t: 'fixed', v: '', k, ...row }])
  const setG = (i: number, p: Partial<GRow>) => setGItems(gs => gs.map((x, j) => (j === i ? { ...x, ...p } : x)))

  // hitung langsung (grup yang sedang diedit ikut dihitung)
  const gid = gName ? (match?.id ?? 'draft') : null
  const groupsDraft: Group[] = gid
    ? [...d.groups.filter(g => g.id !== gid), { id: gid, name: gName, items: gItems.map(i => ({ name: i.n, value: +i.v || 0 })) }]
    : d.groups
  const draft = {
    id: id ?? '', group_id: gid, qty: +f.qty || 0,
    product_costs: costs.map(c => ({ name: c.n, type: c.t, value: +c.v || 0, category: c.k })),
  } as Product
  const c = calcWithGroup(draft, d.products, groupsDraft)
  const gi = groupInfo(draft, d.products, groupsDraft)
  const sell = +f.sell || 0
  const subtotal = (k: CostCategory) => (k === 'bahan' ? c.bahan : c.ops)

  function fillExample() {
    const s = PIN_PRODUCTS[0]
    setF({ ...blank(), name: s.name, cat: PIN_BASE.category, qty: String(PIN_BASE.qty), notes: PIN_BASE.notes, sell: String(s.sell), grp: PIN_GROUP.name })
    setCosts(s.costs.map(x => ({ n: x.name, t: x.type, v: String(x.value), d: x.note, k: x.category })))
    setGItems(PIN_GROUP.items.map(i => ({ n: i.name, v: String(i.value), d: i.note })))
    gKey.current = d.groups.find(g => g.name.toLowerCase() === PIN_GROUP.name.toLowerCase())?.id ?? 'new:' + PIN_GROUP.name.toLowerCase()
    setFile(null); setDropImg(false)
  }

  async function save() {
    if (!f.name.trim()) return toast('Nama produk wajib diisi', true)
    if (!(+f.qty > 0)) return toast('Jumlah produk / porsi harus lebih dari 0', true)
    if (!(c.total > 0)) return toast('Isi bahan baku, biaya operasional, atau biaya bersama lebih dulu', true)
    if (!(sell > 0)) return toast('Pilih atau isi harga jual lebih dulu (klik “Pakai harga ini”)', true)
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis, silakan login lagi.')

      // foto
      let image_path = existing?.image_path ?? null
      if (dropImg && image_path && !file) { await supabase.storage.from('product-images').remove([image_path]); image_path = null }
      if (file) {
        const blob = await resizeImage(file)
        const path = `${user.id}/${crypto.randomUUID()}.jpg`
        must(await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' }))
        if (image_path) await supabase.storage.from('product-images').remove([image_path])
        image_path = path
      }

      // grup biaya bersama (dibuat otomatis kalau namanya baru)
      let group_id: string | null = null
      if (gName) {
        if (match) group_id = match.id
        else {
          const r = await supabase.from('cost_groups').insert({ name: gName }).select('id').single()
          must(r)
          group_id = r.data!.id
        }
        must(await supabase.from('cost_group_items').delete().eq('group_id', group_id))
        const rows = gItems.filter(i => i.n.trim() || +i.v).map((i, k) => ({ group_id, name: i.n.trim() || 'Biaya bersama', value: +i.v || 0, note: i.d ?? null, sort: k }))
        if (rows.length) must(await supabase.from('cost_group_items').insert(rows))
      }

      const row = {
        name: f.name.trim(), category: f.cat.trim() || null, supplier: f.supplier.trim() || null,
        qty: +f.qty, sell_price: sell,
        notes: f.notes.trim() || null, pd: f.pd.trim() || null, purchased_at: f.date || null, group_id, image_path,
      }
      let pid = id
      if (id) must(await supabase.from('products').update(row).eq('id', id))
      else {
        const r = await supabase.from('products').insert(row).select('id').single()
        must(r)
        pid = r.data!.id
      }

      must(await supabase.from('product_costs').delete().eq('product_id', pid!))
      const cr = costs.filter(x => x.n.trim() || +x.v).map((x, k) => ({
        product_id: pid, name: x.n.trim() || (x.k === 'bahan' ? 'Bahan baku' : 'Operasional'), type: x.t, value: +x.v || 0,
        note: x.d ?? null, sort: k, category: x.k,
      }))
      if (cr.length) must(await supabase.from('product_costs').insert(cr))

      // riwayat perhitungan
      const a = at(c, sell)
      must(await supabase.from('price_history').insert({ product_id: pid, price: sell, net: a.net, margin: a.untung }))

      await d.reload()
      toast('Produk tersimpan')
      nav('/produk')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Gagal menyimpan produk.'
      toast(/category|column/i.test(m) ? 'Database belum diperbarui. Jalankan migrasi 005_rumus_baru.sql di Supabase dulu.' : m, true)
      setBusy(false)
    }
  }

  if (id && d.loading) return <Spinner />
  if (id && !existing) return <div className="note bad">Produk tidak ditemukan.</div>
  const imgSrc = preview || (!dropImg && existing?.image_path ? d.images[existing.image_path] : '')

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <p className="mu" style={{ margin: 0, flex: '1 1 240px' }}>Isi bahan baku, biaya operasional, dan biaya bersama. Harga jual langsung dihitung.</p>
        {!id && <button type="button" className="btn sm soft" onClick={fillExample}>Isi contoh</button>}
      </div>
      <div className="split">
        <div>
          <div className="cap">Data produk</div>
          <div className="form">
            {FIELDS.map(([k, label, type]) => (
              <label className="fld" key={k}>
                <span>{label}</span>
                <input type={type} value={f[k]} placeholder={PH[k]} inputMode={type === 'number' ? 'decimal' : undefined}
                  min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} onChange={set(k)} />
              </label>
            ))}
          </div>
          <div className="form">
            <div className="fld col">
              <span>Foto produk</span>
              {imgSrc && (
                <div className="row" style={{ marginTop: 10 }}>
                  <img className="preview" src={imgSrc} alt="Foto produk" style={{ width: 72, height: 72, margin: 0 }} />
                  <button type="button" className="btn sm danger" onClick={() => { setFile(null); setDropImg(true) }}>Hapus foto</button>
                </div>
              )}
              <input type="file" accept="image/*" aria-label="Foto produk" onChange={e => { setFile(e.target.files?.[0] ?? null); setDropImg(false) }} />
            </div>
            <label className="fld col"><span>Catatan</span><textarea value={f.notes} onChange={set('notes')} /></label>
          </div>

          {SECTIONS.map(sec => {
            const rows = costs.map((x, i) => ({ x, i })).filter(r => r.x.k === sec.k)
            const other: CostCategory = sec.k === 'bahan' ? 'operasional' : 'bahan'
            return (
              <section key={sec.k}>
                <div className="cap sech">
                  <span><span className={`dot c-${sec.color}`} />{sec.title}</span>
                  <b>{rp(subtotal(sec.k))}</b>
                </div>
                <div className="form">
                  {rows.length === 0 && <div className="li mu" style={{ fontSize: 14 }}>{sec.empty}</div>}
                  {rows.map(({ x, i }) => (
                    <div className="costrow" key={i}>
                      <input value={x.n} aria-label={`Nama ${sec.title}`} placeholder={sec.k === 'bahan' ? 'Nama bahan' : 'Nama biaya'} onChange={e => setCost(i, { n: e.target.value })} />
                      <select value={x.t} aria-label="Cara hitung" onChange={e => setCost(i, { t: e.target.value as CostType })}>
                        {sec.types.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                      </select>
                      <input type="number" inputMode="decimal" min="0" step="any" aria-label="Nilai" placeholder={x.t === 'pct' ? '%' : 'Rp'} value={x.v} onChange={e => setCost(i, { v: e.target.value })} />
                      <button type="button" className="x mv" title={`Pindah ke ${other === 'bahan' ? 'Bahan baku' : 'Operasional'}`}
                        aria-label={`Pindah ke ${other === 'bahan' ? 'Bahan baku' : 'Operasional'}`}
                        onClick={() => setCost(i, { k: other, t: other === 'bahan' && x.t === 'pct' ? 'fixed' : x.t })}><Icon n="swap" /></button>
                      <button type="button" className="x" aria-label="Hapus" onClick={() => setCosts(cs => cs.filter((_, j) => j !== i))}><Icon n="trash" /></button>
                      {x.t === 'unit' && +x.v > 0 && <small className="rowcalc">{rp(+x.v)} × {c.sq} = {rp(lineTotal({ type: 'unit', value: +x.v }, c.sq))}</small>}
                    </div>
                  ))}
                  <button type="button" className="li addrow" onClick={() => addCost(sec.k)}><Icon n="plus" /> Tambah {sec.title.toLowerCase()}</button>
                  <div style={{ padding: '12px 16px 6px', borderTop: '0.5px solid var(--sep)' }}>
                    <CostTypePicker category={sec.k}
                      onCost={n => addCost(n.k, { n: n.n, t: n.k === 'bahan' && n.t === 'pct' ? 'fixed' : n.t, v: String(n.v || ''), d: n.d })} />
                  </div>
                </div>
                <p className="foot">{sec.hint}</p>
              </section>
            )
          })}

          <div className="cap sech">
            <span><span className="dot c-teal" />Biaya bersama grup (varian)</span>
            <b>{rp(c.share)}</b>
          </div>
          <div className="form">
            <label className="fld">
              <span>Nama grup</span>
              <input value={f.grp} list="grp-list" placeholder="Opsional" onChange={set('grp')} onBlur={e => commitGroup(e.target.value)} />
              <datalist id="grp-list">{d.groups.map(g => <option key={g.id} value={g.name} />)}</datalist>
            </label>
            {gName && (
              <>
                {gItems.map((x, i) => (
                  <div className="costrow g" key={i}>
                    <input value={x.n} aria-label="Nama biaya bersama" placeholder="Nama biaya" onChange={e => setG(i, { n: e.target.value })} />
                    <input type="number" inputMode="decimal" min="0" aria-label="Total biaya bersama (Rp)" placeholder="Rp" value={x.v} onChange={e => setG(i, { v: e.target.value })} />
                    <button type="button" className="x" aria-label="Hapus" onClick={() => setGItems(gs => gs.filter((_, j) => j !== i))}><Icon n="trash" /></button>
                  </div>
                ))}
                <button type="button" className="li addrow" onClick={() => setGItems(gs => [...gs, { n: '', v: '' }])}>
                  <Icon n="plus" /> Tambah biaya bersama (total Rp)
                </button>
                {gi && gi.total > 0 && (
                  <div className="li mu" style={{ fontSize: 13.5 }}>
                    Bagian produk ini: {rp(gi.total)} ÷ {gi.M} produk di grup × {gi.sq} = <b style={{ color: 'var(--label)' }}>{rp(c.share)}</b>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="foot">Untuk alat/biaya yang dipakai beberapa varian. Beri nama grup yang sama di tiap varian; biaya dibagi menurut jumlah produk.</p>

          <div className="cap">Target untung (% dari HPP)</div>
          <MarginInputs />
        </div>

        <div className="sticky">
          <div className="cap">Hasil</div>
          <PriceResult c={c} sell={sell} margins={d.margins} onUse={p => setF(s => ({ ...s, sell: String(p) }))} />
          <div className="form">
            <label className="fld">
              <span>Harga jual dipakai</span>
              <input type="number" inputMode="decimal" min="0" placeholder="Rp" value={f.sell} onChange={set('sell')} />
            </label>
          </div>
          <div className="grid" style={{ gap: 10, marginTop: 14 }}>
            <button type="button" className="btn block" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan produk & harga jual'}</button>
            <button type="button" className="btn block ghost" disabled={busy} onClick={() => { reset(); if (id) nav('/kalkulator') }}>Kosongkan</button>
          </div>
        </div>
      </div>
    </>
  )
}
