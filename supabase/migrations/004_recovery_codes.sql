-- 004: Kode pemulihan password (lupa password tanpa email)
-- Hanya hash kode yang disimpan. Tidak ada policy RLS dan akses dicabut dari user biasa,
-- jadi tabel ini hanya bisa dibaca/ditulis oleh Edge Function `recovery` (service role).
-- Aman dijalankan berulang kali.

create table if not exists public.recovery_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  failed_attempts int not null default 0,   -- percobaan salah berturut-turut
  locked_until timestamptz                  -- dikunci sementara setelah 5x salah
);
create index if not exists recovery_codes_email_idx on public.recovery_codes (email);

alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;
grant select, insert, update, delete on public.recovery_codes to service_role;   -- hanya Edge Function `recovery`
