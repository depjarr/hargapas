import type { Group, Product } from './types'

/** Nama 3 strategi harga. */
export const NM = ['Kompetitif', 'Seimbang', 'Premium']

type Calcable = Pick<Product, 'qty' | 'sellable_qty' | 'purchase_price' | 'product_costs'>

export interface Calc {
  sq: number        // jumlah bisa dijual
  base: number      // total harga beli
  fixed: number     // biaya tetap (termasuk bagian biaya bersama)
  unit: number      // total biaya per unit
  pct: number       // biaya persen (0.08 = 8%)
  share: number     // bagian biaya bersama grup
  total: number     // total modal
  hpp: number       // modal per unit bisa dijual
  breakEven: number // harga impas
}

export function calc(p: Calcable, share = 0): Calc {
  const q = +p.qty || 0
  const sq = +(p.sellable_qty ?? 0) || q || 1
  let fixed = 0, unit = 0, pct = 0
  for (const c of p.product_costs ?? []) {
    const v = +c.value || 0
    if (c.type === 'fixed') fixed += v
    else if (c.type === 'unit') unit += v * sq
    else pct += v / 100
  }
  fixed += share
  const base = (+p.purchase_price || 0) * q
  const total = base + fixed + unit
  const hpp = total / sq
  return { sq, base, fixed, unit, pct, share, total, hpp, breakEven: pct < 1 ? hpp / (1 - pct) : 0 }
}

export const groupTotal = (g?: Group) => (g?.items ?? []).reduce((s, i) => s + (+i.value || 0), 0)
const sellableOf = (p: { sellable_qty: number | null; qty: number }) => +(p.sellable_qty ?? 0) || +p.qty || 0

/** Biaya bersama dibagi ke semua varian satu grup menurut jumlah bisa dijual. */
export function groupInfo(
  p: { id: string; group_id: string | null; qty: number; sellable_qty: number | null },
  all: Product[], groups: Group[],
) {
  const g = p.group_id ? groups.find(x => x.id === p.group_id) : undefined
  if (!g) return null
  const sq = sellableOf(p) || 1
  const others = all.filter(x => x.group_id === g.id && x.id !== p.id).reduce((s, x) => s + sellableOf(x), 0)
  const M = others + sq
  const total = groupTotal(g)
  return { g, M, sq, total, share: (total / M) * sq }
}

export function calcWithGroup(p: Product, all: Product[], groups: Group[]): Calc {
  return calc(p, groupInfo(p, all, groups)?.share ?? 0)
}

/** Hasil kalau dijual di harga tertentu. "untung" = laba bersih ÷ HPP (persen dari modal). */
export function at(c: Calc, price: number) {
  const gross = price - c.hpp
  const fee = price * c.pct
  const net = gross - fee
  return {
    gross, fee, net,
    untung: c.hpp ? (net / c.hpp) * 100 : 0,   // % untung dari modal (sama dengan target)
    margin: price ? (net / price) * 100 : 0,   // % laba dari harga jual (info tambahan)
    total: net * c.sq,
  }
}

/**
 * Harga jual untuk target untung m% dari HPP:
 *   HJ = HPP + (m% × HPP)
 * Contoh: HPP Rp5.000, untung 40% → Rp5.000 + Rp2.000 = Rp7.000.
 * Kalau ada biaya persen (admin marketplace dll.), harga dinaikkan supaya untung tetap utuh:
 *   HJ = (HPP + m% × HPP) ÷ (1 − biaya persen)
 */
export function tgt(c: Calc, m: number): number | null {
  if (!c.hpp || c.pct >= 1) return null
  return Math.round((c.hpp * (1 + m / 100)) / (1 - c.pct))
}

/** Rincian langkah hitung seperti contoh: total biaya → HPP → harga jual. */
export function steps(c: Calc, m: number) {
  const laba = c.hpp * (m / 100)
  const hj = c.hpp + laba
  return { laba, hj, final: tgt(c, m) ?? 0 }
}
