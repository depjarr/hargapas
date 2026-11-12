-- ============================================================
-- HargaPas - schema Supabase
-- Jalankan di: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- Tabel ----------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  target_margins int[] not null default '{15,30,45}',
  created_at     timestamptz not null default now()
);

create table public.cost_groups (          -- biaya bersama (mis. alat cetak untuk beberapa varian)
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  created_at timestamptz not null default now()
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id         uuid references public.cost_groups(id) on delete set null,
  name             text not null,
  category         text,
  supplier         text,
  purchase_price   numeric(14,2) not null default 0 check (purchase_price >= 0), -- harga beli per pcs
  qty              integer not null default 1 check (qty >= 0),                  -- jumlah dibeli
  sellable_qty     integer check (sellable_qty >= 0),                            -- jumlah layak jual
  sell_price       numeric(14,2) not null default 0 check (sell_price >= 0),
  competitor_price numeric(14,2) check (competitor_price >= 0),
  purchased_at     date,
  notes            text,
  image_path       text,                                                         -- path di storage
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.product_costs (        -- biaya tambahan per produk
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('fixed','unit','pct')),  -- total | per pcs | persen dari harga jual
  value      numeric(14,4) not null default 0 check (value >= 0),
  note       text
);

create table public.price_history (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  price      numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (             -- untuk batas pemakaian Konsultan AI per hari
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index on public.cost_groups   (user_id);
create index on public.products      (user_id, created_at desc);
create index on public.products      (group_id);
create index on public.product_costs (product_id);
create index on public.product_costs (user_id);
create index on public.price_history (product_id, created_at desc);
create index on public.ai_usage      (user_id, created_at desc);

-- ---------- Trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- profil otomatis dibuat saat user register
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
alter table public.profiles      enable row level security;
alter table public.cost_groups   enable row level security;
alter table public.products      enable row level security;
alter table public.product_costs enable row level security;
alter table public.price_history enable row level security;
alter table public.ai_usage      enable row level security;

create policy "profiles: baca milik sendiri"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: tambah milik sendiri" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: ubah milik sendiri"   on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: milik sendiri" on public.cost_groups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "products: milik sendiri" on public.products for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (group_id is null or exists (select 1 from public.cost_groups g where g.id = group_id and g.user_id = (select auth.uid())))
  );

create policy "costs: milik sendiri" on public.product_costs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid()))
  );

create policy "history: milik sendiri" on public.price_history for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid()))
  );

create policy "ai_usage: baca milik sendiri"   on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_usage: tambah milik sendiri" on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));
-- sengaja tidak ada policy update/delete di ai_usage, supaya batas harian tidak bisa dihapus user

-- ---------- Storage (foto produk, private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "foto: baca milik sendiri" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: upload ke folder sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: ubah milik sendiri" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: hapus milik sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
