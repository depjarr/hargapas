-- Perbaikan error "permission denied for table ..."
-- Di project Supabase baru, tabel buatan SQL Editor belum otomatis boleh diakses
-- role `authenticated` (user yang sudah login). RLS tetap membatasi: user hanya
-- bisa melihat/mengubah datanya sendiri. Aman dijalankan berulang kali.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- supaya tabel yang dibuat nanti juga ikut
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
