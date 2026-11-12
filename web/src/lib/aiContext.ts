import { at, calcWithGroup } from './calc'
import type { Group, Product } from './types'

/** Ringkasan produk yang dikirim ke Konsultan AI (sama dengan ctx() di HTML). */
export function buildContext(products: Product[], groups: Group[]) {
  return products.slice(0, 40).map(p => {
    const c = calcWithGroup(p, products, groups)
    const a = p.sell_price > 0 ? at(c, p.sell_price) : null
    return {
      nama: p.name, kategori: p.category, hpp: Math.round(c.hpp), total_modal: Math.round(c.total),
      biaya_persen: +(c.pct * 100).toFixed(2), harga_jual: p.sell_price || null,
      laba_bersih_per_unit: a ? Math.round(a.net) : null, untung_persen_dari_hpp: a ? +a.untung.toFixed(2) : null, margin_persen_dari_harga: a ? +a.margin.toFixed(2) : null,
      harga_pesaing_input_user: p.competitor_price || null, target_pelanggan: p.aud || null,
    }
  })
}
