import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Chat, Cost, CostTypeRow, Group, Product, Profile } from './types'

interface DataCtx {
  products: Product[]; groups: Group[]; costTypes: CostTypeRow[]; chats: Chat[]; profile: Profile | null
  images: Record<string, string>; loading: boolean; error: string; margins: number[]
  reload: () => Promise<void>
  refreshTypes: () => Promise<void>
  refreshChats: () => Promise<void>
  setMargin: (i: number, v: number) => void
}
const Ctx = createContext<DataCtx | null>(null)
const num = (v: unknown) => +(v as number) || 0

/**
 * Ubah baris database ke bentuk aplikasi.
 * Data sebelum migrasi 005 (masih ada harga beli / jumlah bisa dijual) dibaca setara:
 * harga beli × jumlah dibeli → baris bahan baku "Bahan utama", jumlah produk = jumlah bisa dijual.
 */
function toProduct(x: any): Product {
  const { purchase_price, sellable_qty, material_cost, ...rest } = x
  const costs: Cost[] = [...(x.product_costs ?? [])].map((k: any) => ({
    ...k, value: num(k.value), category: k.category ?? (k.type === 'pct' ? 'operasional' : 'bahan'),
  }))
  let qty = num(x.qty)
  const legacy = (v: number) => costs.push({ name: 'Bahan utama', type: 'fixed', value: v, note: x.pd, sort: -1, category: 'bahan' })
  if (material_cost != null) { if (num(material_cost) > 0) legacy(num(material_cost)) }
  else {
    if (num(purchase_price) > 0) legacy(num(purchase_price) * qty)
    if (num(sellable_qty) > 0) qty = num(sellable_qty)
  }
  return {
    ...rest, qty,
    sell_price: num(x.sell_price),
    competitor_price: x.competitor_price == null ? null : num(x.competitor_price),
    product_costs: costs.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
    price_history: (x.price_history ?? []).map((h: any) => ({
      ...h, price: num(h.price), net: h.net == null ? null : num(h.net), margin: h.margin == null ? null : num(h.margin),
    })),
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [costTypes, setCostTypes] = useState<CostTypeRow[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [margins, setMargins] = useState<number[]>([15, 30, 45])
  const first = useRef(true)
  const pending = useRef<number[]>([15, 30, 45])
  const timer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    const [p, g, t, c, pr] = await Promise.all([
      supabase.from('products').select('*, product_costs(*), price_history(*)').order('created_at', { ascending: false }),
      supabase.from('cost_groups').select('*, cost_group_items(*)').order('name'),
      supabase.from('cost_types').select('*').order('created_at'),
      supabase.from('chats').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').maybeSingle(),
    ])
    const err = p.error || g.error || t.error || c.error || pr.error
    if (err) { setError(err.message); setLoading(false); return }

    const ps: Product[] = ((p.data ?? []) as any[]).map(toProduct)
    setProducts(ps)
    setGroups(((g.data ?? []) as any[]).map(x => ({
      id: x.id, name: x.name,
      items: [...(x.cost_group_items ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .map((i: any) => ({ id: i.id, name: i.name, value: num(i.value), note: i.note })),
    })))
    setCostTypes(((t.data ?? []) as any[]).map(x => ({ id: x.id, name: x.name, type: x.type, value: num(x.value) })))
    setChats((c.data ?? []) as Chat[])
    setProfile(pr.data as Profile | null)
    if (first.current) {
      first.current = false
      const m = (pr.data as Profile | null)?.target_margins
      if (m?.length === 3) { const n = m.map(Number); setMargins(n); pending.current = n }
    }

    const paths = ps.map(x => x.image_path).filter((x): x is string => !!x)
    if (paths.length) {
      const { data } = await supabase.storage.from('product-images').createSignedUrls(paths, 3600)
      const map: Record<string, string> = {}
      data?.forEach(d => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl })
      setImages(map)
    } else setImages({})
    setError('')
    setLoading(false)
  }, [])

  const refreshTypes = useCallback(async () => {
    const { data } = await supabase.from('cost_types').select('*').order('created_at')
    setCostTypes(((data ?? []) as any[]).map(x => ({ id: x.id, name: x.name, type: x.type, value: num(x.value) })))
  }, [])
  const refreshChats = useCallback(async () => {
    const { data } = await supabase.from('chats').select('*').order('created_at', { ascending: false })
    setChats((data ?? []) as Chat[])
  }, [])

  // target margin: tampil langsung, disimpan ke profil setelah berhenti mengetik
  const setMargin = useCallback((i: number, v: number) => {
    setMargins(m => { const n = [...m]; n[i] = v; pending.current = n; return n })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await supabase.from('profiles').upsert({ id: session.user.id, target_margins: pending.current })
    }, 700)
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <Ctx.Provider value={{ products, groups, costTypes, chats, profile, images, loading, error, margins, reload, refreshTypes, refreshChats, setMargin }}>
      {children}
    </Ctx.Provider>
  )
}

export function useData() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useData harus dipakai di dalam DataProvider')
  return c
}

/** Lempar error kalau response Supabase gagal. */
export function must(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message)
}
