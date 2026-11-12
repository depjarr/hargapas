import type { Cost, Group, Product } from './types'

/** Nama 3 strategi harga. */
export const NM = ['Kompetitif', 'Seimbang', 'Premium']

type Calcable = Pick<Product, 'qty' | 'product_costs'>

export interface Calc {
  sq: number        // jumlah produk/porsi
  bahan: number     // biaya bahan baku (total)
  ops: number       // biaya operasional/tenaga kerja (total, tanpa biaya persen)
  share: number     // bagian biaya bersama grup
  pct: number       // biaya persen dari harga jual (0.08 = 8%)
  total: number     // total biaya produksi = bahan + ops + share
  hpp: number       // HPP per produk/porsi
  breakEven: number // harga impas
}

/** Nilai total satu baris biaya: "total" apa adanya, "per produk" dikali jumlah produk. Persen tidak masuk biaya produksi. */
export const lineTotal = (c: Pick<Cost, 'type' | 'value'>, sq: number) =>
  c.type === 'unit' ? (+c.value || 0) * sq : c.type === 'fixed' ? +c.value || 0 : 0

/**
 * Rumus:
 *   1. Total biaya produksi = biaya bahan baku + biaya operasional/tenaga kerja + bagian biaya bersama grup
 *   2. HPP                  = total biaya produksi ÷ jumlah produk/porsi
 *   3. Harga jual           = HPP + (target untung % × HPP)   → lihat tgt()
 */
export function calc(p: Calcable, share = 0): Calc {
  const sq = +p.qty || 1
  let bahan = 0, ops = 0, pct = 0
  for (const c of p.product_costs ?? []) {
    if (c.type === 'pct') { pct += (+c.value || 0) / 100; continue }
    if (c.category === 'operasional') ops += lineTotal(c, sq)
    else bahan += lineTotal(c, sq)
  }
  const total = bahan + ops + share
  const hpp = total / sq
  return { sq, bahan, ops, share, pct, total, hpp, breakEven: pct < 1 ? hpp / (1 - pct) : 0 }
}

export const groupTotal = (g?: Group) => (g?.items ?? []).reduce((s, i) => s + (+i.value || 0), 0)
const sellableOf = (p: { qty: number }) => +p.qty || 0

/** Biaya bersama dibagi ke semua varian satu grup menurut jumlah produk. */
export function groupInfo(
  p: { id: string; group_id: string | null; qty: number },
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
