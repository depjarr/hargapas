import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { must, useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { today } from '../lib/format'
import { PIN_BASE, PIN_GROUP, PIN_PRODUCTS } from '../lib/sample'
import MarginInputs from '../components/MarginInputs'
import ConfirmButton from '../components/ConfirmButton'
import Icon from '../components/Icon'
import RecoveryPanel from '../components/RecoveryPanel'

export default function Settings() {
  const d = useData()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function loadSample() {
    setBusy(true)
    try {
      let gid = d.groups.find(g => g.name.toLowerCase() === PIN_GROUP.name.toLowerCase())?.id
      if (!gid) {
        const r = await supabase.from('cost_groups').insert({ name: PIN_GROUP.name }).select('id').single()
        must(r)
        gid = r.data!.id as string
      }
      must(await supabase.from('cost_group_items').delete().eq('group_id', gid))
      must(await supabase.from('cost_group_items').insert(PIN_GROUP.items.map((i, k) => ({ group_id: gid, name: i.name, value: i.value, note: i.note, sort: k }))))
      for (const s of PIN_PRODUCTS) {
        if (d.products.some(p => p.name === s.name)) continue
        const r = await supabase.from('products').insert({
          name: s.name, category: PIN_BASE.category, purchase_price: PIN_BASE.purchase_price, qty: PIN_BASE.qty,
          sellable_qty: PIN_BASE.sellable_qty, sell_price: s.sell, pd: PIN_BASE.pd, notes: PIN_BASE.notes, group_id: gid, purchased_at: today(),
        }).select('id').single()
        must(r)
        must(await supabase.from('product_costs').insert(s.costs.map((c, k) => ({ product_id: r.data!.id, name: c.name, type: c.type, value: c.value, note: c.note ?? null, sort: k }))))
      }
      await d.reload()
      toast('Data contoh dimuat')
    } catch (e) { toast(e instanceof Error ? e.message : 'Gagal memuat data contoh.', true) }
    setBusy(false)
  }

  async function wipe() {
    setBusy(true)
    try {
      const paths = d.products.map(p => p.image_path).filter((x): x is string => !!x)
      if (paths.length) await supabase.storage.from('product-images').remove(paths)
      must(await supabase.from('products').delete().not('id', 'is', null))
      must(await supabase.from('chats').delete().not('id', 'is', null))
      await d.reload()
      toast('Semua data produk dan percakapan dihapus')
      nav('/')
    } catch (e) { toast(e instanceof Error ? e.message : 'Gagal menghapus data.', true) }
    setBusy(false)
  }

  return (
    <div className="split">
      <div>
        <div className="cap" style={{ marginTop: 0 }}>Target untung bawaan (% dari HPP)</div>
        <MarginInputs />
        <p className="foot">Contoh: HPP Rp5.000 dengan target 40% → harga jual Rp5.000 + Rp2.000 = Rp7.000.</p>
      </div>
      <div>
        <div className="cap" style={{ marginTop: 0 }}>Keamanan akun</div>
        <RecoveryPanel />
        <div className="cap">Data</div>
        <div className="card">
          <p className="mu">Data tersimpan di akun Anda dan hanya terlihat oleh Anda.</p>
          <div className="row">
            <button className="btn sm soft" disabled={busy} onClick={loadSample}>Muat data contoh</button>
            <ConfirmButton className="btn sm danger" disabled={busy} onConfirm={wipe}>Hapus semua data</ConfirmButton>
          </div>
        </div>
        <div className="group">
          <button className="li danger" onClick={() => supabase.auth.signOut()}>
            <span className="ico sm c-red"><Icon n="logout" /></span><span className="grow">Keluar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
