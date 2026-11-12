-- 006: Notifikasi (Web Push) — ringkasan mingguan & keamanan akun.
-- Setelah file ini, jalankan juga supabase/setup-notifikasi.local.sql (berisi rahasia, tidak ada di GitHub).
-- Aman dijalankan berulang kali.

-- Perangkat yang mengizinkan notifikasi (satu baris per browser/HP)
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Pilihan notifikasi per pengguna (kalau belum ada baris = semua aktif)
create table if not exists public.notification_settings (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  weekly_summary  boolean not null default true,
  security_alerts boolean not null default true,
  updated_at      timestamptz not null default now()
);

alter table public.push_subscriptions    enable row level security;
alter table public.notification_settings enable row level security;

drop policy if exists "push subs: milik sendiri" on public.push_subscriptions;
create policy "push subs: milik sendiri" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "notif settings: milik sendiri" on public.notification_settings;
create policy "notif settings: milik sendiri" on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions, public.notification_settings to authenticated;
-- function `push` (service_role) membaca produk & mengirim notifikasi
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

-- Jadwal ringkasan mingguan: setiap Senin 08.00 WIB (= 01.00 UTC) memanggil Edge Function `push`.
-- Alamat project & kunci rahasia diambil dari Vault (diisi lewat setup-notifikasi.local.sql).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'hargapas-ringkasan-mingguan') then
    perform cron.unschedule('hargapas-ringkasan-mingguan');
  end if;
end $$;

select cron.schedule(
  'hargapas-ringkasan-mingguan',
  '0 1 * * 1',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'hargapas_project_url') || '/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hargapas_cron_secret')
    ),
    body    := '{"action":"weekly"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
