-- ============================================================
-- 003: menyamakan struktur data dengan alur di Smart_Pricing_AI_1.html
-- Jalankan di SQL Editor SETELAH 001 dan 002. Aman dijalankan ulang.
-- ============================================================

-- produk: keterangan harga beli + target pelanggan
alter table public.products add column if not exists pd  text;
alter table public.products add column if not exists aud text;

-- urutan biaya tambahan dipertahankan
alter table public.product_costs add column if not exists sort int not null default 0;

-- riwayat perhitungan: simpan laba & margin saat produk disimpan
alter table public.price_history add column if not exists net    numeric(14,2);
alter table public.price_history add column if not exists margin numeric(8,2);

-- target margin boleh desimal (mis. 7,5)
alter table public.profiles alter column target_margins drop default;
alter table public.profiles alter column target_margins type numeric[] using target_margins::numeric[];
alter table public.profiles alter column target_margins set default '{15,30,45}'::numeric[];

-- grup biaya bersama: satu grup punya BANYAK item biaya
create table if not exists public.cost_group_items (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.cost_groups(id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name     text not null,
  value    numeric(14,2) not null default 0 check (value >= 0),
  note     text,
  sort     int not null default 0
);
create index if not exists cost_group_items_group_idx on public.cost_group_items (group_id);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cost_groups' and column_name = 'total_cost') then
    insert into public.cost_group_items (group_id, user_id, name, value)
      select id, user_id, 'Biaya bersama', total_cost from public.cost_groups where total_cost > 0;
    alter table public.cost_groups drop column total_cost;
  end if;
end $$;

create unique index if not exists cost_groups_user_name_uq on public.cost_groups (user_id, lower(name));

-- jenis biaya buatan sendiri (daftar di kolom "Jenis biaya")
create table if not exists public.cost_types (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null default 'fixed' check (type in ('fixed','unit','pct')),
  value      numeric(14,4) not null default 0 check (value >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists cost_types_user_name_uq on public.cost_types (user_id, lower(name));

-- percakapan Konsultan AI
create table if not exists public.chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists chats_user_idx on public.chats (user_id, created_at desc);
create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

-- RLS
alter table public.cost_group_items enable row level security;
alter table public.cost_types       enable row level security;
alter table public.chats            enable row level security;
alter table public.chat_messages    enable row level security;

drop policy if exists "group items: milik sendiri" on public.cost_group_items;
create policy "group items: milik sendiri" on public.cost_group_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.cost_groups g where g.id = group_id and g.user_id = (select auth.uid())));

drop policy if exists "cost types: milik sendiri" on public.cost_types;
create policy "cost types: milik sendiri" on public.cost_types for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "chats: milik sendiri" on public.chats;
create policy "chats: milik sendiri" on public.chats for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "chat messages: milik sendiri" on public.chat_messages;
create policy "chat messages: milik sendiri" on public.chat_messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.chats c where c.id = chat_id and c.user_id = (select auth.uid())));

-- izin akses tabel baru
grant select, insert, update, delete on public.cost_group_items, public.cost_types, public.chats, public.chat_messages to authenticated;
