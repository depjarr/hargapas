export type CostType = 'fixed' | 'unit' | 'pct'

export interface Cost { id?: string; name: string; type: CostType; value: number; note?: string | null; sort?: number }
export interface Hist { id: string; product_id: string; price: number; net: number | null; margin: number | null; created_at: string }

export interface Product {
  id: string
  user_id: string
  group_id: string | null
  name: string
  category: string | null
  supplier: string | null
  purchase_price: number
  qty: number
  sellable_qty: number | null
  sell_price: number
  competitor_price: number | null
  aud: string | null            // target pelanggan
  pd: string | null             // keterangan harga beli
  purchased_at: string | null
  notes: string | null
  image_path: string | null
  created_at: string
  product_costs: Cost[]
  price_history: Hist[]
}

export interface GroupItem { id?: string; name: string; value: number; note?: string | null }
export interface Group { id: string; name: string; items: GroupItem[] }
export interface CostTypeRow { id: string; name: string; type: CostType; value: number }
export interface Chat { id: string; title: string; created_at: string }
export interface ChatMsg { id: string; chat_id: string; role: 'user' | 'assistant'; content: string; created_at: string }
export interface Profile { id: string; display_name: string | null; target_margins: number[] }
