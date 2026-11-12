import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { fnErrorMessage } from '../lib/fn'
import { resizeToDataUrl } from '../lib/image'
import { rp } from '../lib/format'
import type { CostCategory, CostType } from '../lib/types'
import Icon from './Icon'

export interface NewCost { n: string; t: CostType; v: number; d?: string; k: CostCategory }
interface Props {
  onCost: (c: NewCost) => void
  category: CostCategory
}
interface OcItem { n: string; q: number; t: number; u: 'unit' | 'fixed'; on: boolean }


/** Kolom "Jenis biaya": pilih / tambah jenis biaya, isi manual, atau scan struk. */
export default function CostTypePicker({ onCost, category }: Props) {
  const { costTypes, refreshTypes } = useData()
  const toast = useToast()
  const [sel, setSel] = useState('')      // '' | 'buy' | id jenis biaya
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [oc, setOc] = useState<OcItem[]>([])
  const [msg, setMsg] = useState<{ err: boolean; m: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const selType = costTypes.find(c => c.id === sel)
  const shown = selType?.name ?? text
  const ready = !!selType
  const q = text.trim().toLowerCase()
  const list = q ? costTypes.filter(c => c.name.toLowerCase().includes(q)) : costTypes

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  function choose(id: string) { setSel(id); setText(''); setOpen(false); setOc([]); setMsg(null) }

  async function add() {
    const v = text.trim()
    if (!v) return
    const r = await supabase.from('cost_types').insert({ name: v, type: 'fixed', value: 0 }).select('id').single()
    if (r.error) return toast(r.error.message, true)
    await refreshTypes()
    choose(r.data.id)
  }
  async function del(id: string) {
    const r = await supabase.from('cost_types').delete().eq('id', id)
    if (r.error) return toast(r.error.message, true)
    await refreshTypes()
    if (sel === id) { setSel(''); setText('') }
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = e.currentTarget.value.trim()
    if (!v) return
    const ex = costTypes.find(c => c.name.toLowerCase() === v.toLowerCase())
    if (ex) choose(ex.id); else add()
  }

  function manual() {
    if (selType) onCost({ n: selType.name, t: selType.type, v: selType.value || 0, k: category })
  }

  async function onFile(f?: File) {
    if (!f) return
    if (!f.type.startsWith('image/')) return setMsg({ err: true, m: 'Untuk saat ini hanya foto atau gambar (JPG, PNG). PDF belum didukung.' })
    if (f.size > 15e6) return setMsg({ err: true, m: 'Ukuran file maksimal 15 MB.' })
    setBusy(true); setMsg(null); setOc([])
    try {
      const image = await resizeToDataUrl(f, 1400)
      const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { image } })
      if (error) throw new Error(await fnErrorMessage(error, 'Pembacaan gambar gagal.'))
      const items: OcItem[] = (data?.items ?? []).map((x: { name?: string; qty?: number; total?: number; kind?: string }) => ({
        n: x.name || '', q: +(x.qty ?? 1) || 1, t: +(x.total ?? 0) || 0,
        u: x.kind === 'barang' ? 'unit' : 'fixed', on: true,
      }))
      if (!items.length) setMsg({ err: true, m: 'Tidak ada item terbaca. Coba gambar yang lebih jelas atau isi manual.' })
      setOc(items)
    } catch (e) {
      setMsg({ err: true, m: `Gagal membaca: ${e instanceof Error ? e.message : 'terjadi kesalahan'}. Anda tetap bisa mengisi manual.` })
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function addAll() {
    let n = 0
    const nm = selType?.name ?? ''
    oc.filter(x => x.on && x.t).forEach(x => {
      const q = x.q > 0 ? x.q : 1
      const d = 'Dari struk: ' + rp(x.t) + (x.u === 'fixed' ? '' : ' ÷ ' + q + ' pcs')
      onCost({ n: x.n ? nm + ': ' + x.n : nm, t: x.u, v: x.u === 'unit' ? Math.round((x.t / q) * 100) / 100 : x.t, d, k: category })
      n++
    })
    setOc([])
    toast(n + ' baris ditambahkan')
  }
  const upd = (i: number, patch: Partial<OcItem>) => setOc(o => o.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const opts: [OcItem['u'], string][] = [['unit', 'Per produk (total ÷ jumlah pcs)'], ['fixed', 'Total (dibagi ke semua produk)']]

  return (
    <>
      <div className="combo" ref={box}>
        <label>Pilih dari daftar tersimpan / scan struk
          <input value={shown} autoComplete="off" enterKeyHint="done"
            placeholder="Ketik nama biaya lalu Enter, atau pilih"
            onFocus={() => setOpen(true)}
            onChange={e => { setSel(''); setText(e.target.value); setOpen(true); setOc([]); setMsg(null) }}
            onKeyDown={onKey} />
        </label>
        {open && (
          <div className="ctl">
            {list.map(c => (
              <div className="ci" key={c.id} onClick={() => choose(c.id)}>
                <span>{c.name}</span>
                <button type="button" aria-label={`Hapus ${c.name}`} onClick={e => { e.stopPropagation(); del(c.id) }}><Icon n="x" /></button>
              </div>
            ))}
            {text.trim() && !costTypes.some(c => c.name.toLowerCase() === q) && (
              <div className="ci" onClick={add}><span>+ Tambah “{text.trim()}” (Enter)</span></div>
            )}
          </div>
        )}
      </div>

      {ready ? (
        <div style={{ margin: '4px 0 10px' }}>
          <div className="row">
            <button type="button" className="btn sm" onClick={manual}><Icon n="plus" />Tambahkan</button>
            <button type="button" className="btn sm soft" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon n="camera" />{busy ? 'Membaca gambar…' : 'Scan struk'}
            </button>
          </div>
          <small>Di HP, akan muncul pilihan: ambil foto dengan kamera atau pilih dari galeri.</small>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={e => onFile(e.target.files?.[0])} />
        </div>
      ) : (
        <small>Opsional: simpan nama biaya yang sering dipakai, lalu pilih untuk mengisi cepat atau scan struk.</small>
      )}

      {msg && <p className={msg.err ? 'bad' : 'ok'}>{msg.m}</p>}

      {oc.length > 0 && (
        <div>
          <h3>Hasil bacaan untuk: {selType?.name}</h3>
          <small>Koreksi bila salah. Tidak ada yang masuk sebelum kamu menekan tombol di bawah.</small>
          {oc.map((x, i) => (
            <div className="card" style={{ padding: 12, margin: '8px 0', background: 'var(--fill-2)', boxShadow: 'none' }} key={i}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto', minHeight: 0, margin: 0 }} checked={x.on} onChange={e => upd(i, { on: e.target.checked })} /> Pakai baris ini
              </label>
              <input value={x.n} aria-label="Nama item" onChange={e => upd(i, { n: e.target.value })} />
              <div className="grid g2" style={{ marginTop: 6 }}>
                <label>Jumlah pcs<input type="number" value={x.q} onChange={e => upd(i, { q: +e.target.value })} /></label>
                <label>Total (Rp)<input type="number" value={x.t} onChange={e => upd(i, { t: +e.target.value })} /></label>
              </div>
              <label>Masukkan sebagai
                <select value={x.u} onChange={e => upd(i, { u: e.target.value as OcItem['u'] })}>
                  {opts.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                </select>
              </label>
            </div>
          ))}
          <button type="button" className="btn" onClick={addAll}>Tambahkan ke kalkulator</button>
        </div>
      )}
    </>
  )
}
