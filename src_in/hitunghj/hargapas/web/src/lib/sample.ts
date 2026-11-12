import type { CostCategory, CostType } from './types'

/** Contoh Pin Magnet: 2 varian, alat cetak (biaya bersama grup) dibagi ke dua varian. */
export const PIN_GROUP = {
  name: 'Pin Magnet',
  items: [{ name: 'Alat cetak + 100 pin', value: 375000, note: '1 alat cetak, sudah termasuk 100 pcs pin' }],
}
export const PIN_BASE = {
  category: 'Aksesoris', qty: 50,
  notes: 'Contoh pin magnet: 50 pcs per varian, alat cetak 375.000 dibagi 2 varian',
}
type SC = { name: string; type: CostType; value: number; note?: string; category: CostCategory }
const magnet: SC = { name: 'Magnet pin', type: 'unit', value: 1700, note: 'Rp1.700 per pcs', category: 'bahan' }
const sticker: SC = { name: 'Sticker glossy', type: 'unit', value: 1000, note: 'Isi 20 pcs Rp20.000, jadi Rp20.000 ÷ 20 pcs', category: 'bahan' }
const common: SC[] = [
  { name: 'Plastik', type: 'unit', value: 200, note: 'Rp200 per pcs', category: 'bahan' },
  { name: 'Print latar & kartu thank you', type: 'unit', value: 1000, note: 'Rp1.000 per pin (latar + kartu thank you)', category: 'bahan' },
  { name: 'Admin marketplace', type: 'pct', value: 8, category: 'operasional' },
  { name: 'Biaya pembayaran', type: 'pct', value: 2, category: 'operasional' },
]
export const PIN_PRODUCTS: { name: string; sell: number; costs: SC[] }[] = [
  { name: 'Pin Magnet Glossy', sell: 12900, costs: [magnet, sticker, ...common] },
  {
    name: 'Pin Magnet Glitter', sell: 17900,
    costs: [magnet, sticker, { name: 'Laminasi glitter', type: 'unit', value: 2900, note: 'Isi 20 pcs Rp58.000, jadi Rp58.000 ÷ 20 pcs', category: 'bahan' }, ...common],
  },
]
