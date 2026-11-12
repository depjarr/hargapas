-- 005: Rumus baru, biaya dipisah jadi 3 bagian.
--   Total biaya produksi = bahan baku + operasional/tenaga kerja + bagian biaya bersama grup
--   HPP                  = total biaya produksi ÷ jumlah produk/porsi
--   Harga jual           = HPP + (target untung % × HPP)
--
-- Yang dilakukan:
--   1. product_costs dapat kolom `category`: 'bahan' (bahan baku) atau 'operasional'.
--   2. Data lama dipindahkan TANPA mengubah HPP:
--        harga beli × jumlah dibeli  → 1 baris bahan baku "Bahan utama" (total)
--        jumlah bisa dijual          → jumlah produk (qty)
--        biaya persen & biaya bernama tenaga kerja/listrik/sewa/admin/dll → operasional, sisanya → bahan baku
--   3. Kolom lama di products dihapus: purchase_price, sellable_qty, material_cost.
-- Aman dijalankan berulang kali, dan aman walau versi 005 sebelumnya (material_cost) sudah sempat dijalankan.

alter table public.product_costs add column if not exists category text not null default 'bahan';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_costs_category_check') then
    alter table public.product_costs add constraint product_costs_category_check check (category in ('bahan', 'operasional'));
  end if;
end $$;

do $$
declare
  has_pp boolean := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'purchase_price');
  has_sq boolean := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'sellable_qty');
  has_mc boolean := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'material_cost');
begin
  if not (has_pp or has_sq or has_mc) then
    return;  -- sudah pernah dijalankan
  end if;

  -- biaya lama: kelompokkan ke operasional kalau persen atau namanya jelas biaya operasional
  update public.product_costs
  set category = 'operasional'
  where type = 'pct'
     or name ~* '(tenaga|kerja|karyawan|gaji|upah|listrik|sewa|gas|air|bensin|transport|ongkir|kirim|admin|pembayaran|operasional|internet|pulsa|jahit|jasa|ongkos)';

  -- bahan utama dari data lama (dihitung SEBELUM jumlah diubah)
  if has_mc then
    execute $q$
      insert into public.product_costs (product_id, user_id, name, type, value, note, sort, category)
      select p.id, p.user_id, 'Bahan utama', 'fixed', p.material_cost, p.pd, -1, 'bahan'
      from public.products p
      where coalesce(p.material_cost, 0) > 0
        and not exists (select 1 from public.product_costs c where c.product_id = p.id and c.name = 'Bahan utama' and c.sort = -1)
    $q$;
  end if;
  if has_pp then
    execute $q$
      insert into public.product_costs (product_id, user_id, name, type, value, note, sort, category)
      select p.id, p.user_id, 'Bahan utama', 'fixed', p.purchase_price * coalesce(p.qty, 0), p.pd, -1, 'bahan'
      from public.products p
      where coalesce(p.purchase_price, 0) > 0 and coalesce(p.qty, 0) > 0
        and not exists (select 1 from public.product_costs c where c.product_id = p.id and c.name = 'Bahan utama' and c.sort = -1)
    $q$;
  end if;

  -- jumlah produk = jumlah bisa dijual (kalau dulu diisi)
  if has_sq then
    execute $q$ update public.products set qty = coalesce(nullif(sellable_qty, 0), qty) $q$;
  end if;

  alter table public.products drop column if exists purchase_price;
  alter table public.products drop column if exists sellable_qty;
  alter table public.products drop column if exists material_cost;
end $$;

comment on column public.products.qty is 'Jumlah produk/porsi yang dihasilkan';
comment on column public.product_costs.category is 'bahan = bahan baku, operasional = operasional/tenaga kerja (biaya persen dipotong dari harga jual)';
comment on column public.product_costs.type is 'fixed = total untuk semua produk, unit = per produk, pct = persen dari harga jual';
