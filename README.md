# HargaPas (React + Supabase)

Stack: React + Vite + TypeScript (frontend) · Supabase Auth/Postgres/Storage (backend) · Supabase Edge Function + Groq API (Konsultan AI).

## 1. Database
1. Buat project di https://supabase.com
2. Buka **SQL Editor**, paste isi `supabase/migrations/001_schema.sql`, klik **Run**.
   (Membuat tabel, RLS, trigger profil otomatis, dan bucket foto `product-images`.)
3. Jalankan juga `supabase/migrations/003_flow_parity.sql` (tabel grup biaya, jenis biaya, riwayat, percakapan AI).
4. Jalankan juga `supabase/migrations/002_grants.sql` (urutan: 001, 002, 003, 004, lalu 005) (memberi izin akses tabel ke user yang login; tanpa ini muncul error "permission denied for table ...").
5. Jalankan `supabase/migrations/004_recovery_codes.sql` (tabel kode pemulihan password).
6. Jalankan `supabase/migrations/005_rumus_baru.sql` (biaya dipisah jadi bahan baku / operasional / biaya bersama, kolom "harga beli" dihapus). **Wajib dijalankan sebelum memakai versi web terbaru**, kalau tidak, menyimpan produk akan gagal. Data lama diubah otomatis **tanpa mengubah HPP**:
   - harga beli × jumlah dibeli → baris bahan baku "Bahan utama"
   - jumlah bisa dijual → jumlah produk
   - biaya persen dan biaya bernama tenaga kerja/listrik/sewa/admin/dll → operasional, sisanya → bahan baku (bisa dipindah lewat tombol ⇄ di Kalkulator)
   - kolom `purchase_price`, `sellable_qty` (dan `material_cost` kalau ada) dihapus dari tabel `products`

### Rumus harga jual
1. **Total biaya produksi** = bahan baku + operasional/tenaga kerja + bagian biaya bersama grup
2. **HPP per produk** = total biaya produksi ÷ jumlah produk/porsi
3. **Harga jual** = HPP + (target untung % × HPP)

Contoh: Rp150.000 + Rp100.000 = Rp250.000 → ÷ 50 porsi = Rp5.000 → Rp5.000 + 40% = **Rp7.000**.
Biaya persen (admin marketplace, biaya pembayaran) tidak masuk total biaya produksi; harga jual dinaikkan supaya potongan itu tidak memakan untung.

## 2. Auth
Login hanya dengan **email + password** (Authentication > Providers > Email, aktif secara default). Tidak ada login Google.
- **Authentication > URL Configuration**: isi *Site URL* (mis. `http://localhost:5173`). Saat deploy, ganti dengan URL produksi.
- Supaya kode pemulihan langsung muncul setelah daftar, matikan **Confirm email** (Authentication > Providers > Email). Kalau tetap aktif, user membuat kodenya sendiri di menu **Pengaturan** setelah verifikasi email dan masuk.

### Kode pemulihan password (tanpa email)
Lupa password memakai **email + kode pemulihan**, bukan link email. Kode `HARGA-XXXX-XXXX` ditampilkan **sekali** setelah daftar (bisa disalin atau disimpan sebagai gambar) dan bisa dibuat ulang di **Pengaturan**. Setelah dipakai ganti password, kode lama hangus dan user langsung diberi kode baru.
- Yang disimpan hanya hash-nya (PBKDF2-SHA256 + salt). Tabel `recovery_codes` tidak bisa dibaca user, hanya oleh Edge Function `recovery`.
- 5x salah berturut-turut → email itu dikunci 15 menit.
- Butuh Edge Function `recovery` (lihat bagian 3). Kunci service role sudah otomatis tersedia di Edge Function, jadi tidak perlu secret tambahan. Jangan pernah menaruh service role key di frontend.

## 3. Edge Function (4 buah)
Deploy **empat** function dengan nama persis: `ai-consultant` (Konsultan AI + tool simulasi), `scan-receipt` (baca foto struk), `recovery` (kode pemulihan password), dan `push` (notifikasi). Secret `GROQ_API_KEY` dipakai dua function AI. Model baca gambar: `qwen/qwen3.8-27b` (ganti lewat secret `GROQ_VISION_MODEL`).

`recovery` dan `push` **wajib** di-deploy dengan `--no-verify-jwt` (function memeriksa login / kunci jadwal sendiri).

## 3a. Notifikasi (ringkasan mingguan & keamanan akun)
1. Jalankan `supabase/migrations/006_notifications.sql` (tabel perangkat & pilihan notifikasi, jadwal tiap Senin 08.00 WIB). Kalau error soal `pg_cron`/`pg_net`, aktifkan dulu di **Database > Extensions**.
2. Jalankan `supabase/setup-notifikasi.local.sql` sekali di SQL Editor (alamat project + kunci jadwal ke Vault). File ini berisi rahasia dan **tidak** ada di GitHub.
3. Pasang rahasia function: `supabase secrets set --env-file supabase/functions/.env` (atau isi manual di **Edge Functions > Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`).
4. Deploy `push` dan deploy ulang `recovery`.
5. Di Vercel tambahkan env `VITE_VAPID_PUBLIC_KEY` (kunci **publik**, sama dengan di `web/.env`), lalu redeploy.

Kunci VAPID baru bisa dibuat dengan `npx web-push generate-vapid-keys`. Di iPhone, notifikasi hanya jalan setelah aplikasi dipasang ke Layar Utama (iOS 16.4+).

## 3b. Aturan password
Web dan function `recovery` mewajibkan: minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol. Samakan juga di **Authentication > Providers > Email > Password requirements** (minimum length 8, *Lowercase, uppercase letters, digits and symbols*) supaya pendaftaran lewat API langsung pun ikut ditolak.

## 3c. Deploy semua function
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set GROQ_API_KEY=gsk_xxxxx
supabase functions deploy ai-consultant
supabase functions deploy scan-receipt
supabase functions deploy recovery --no-verify-jwt
supabase functions deploy push --no-verify-jwt
```
Buat API key di https://console.groq.com/keys. Model default `openai/gpt-oss-120b`; ganti dengan `supabase secrets set GROQ_MODEL=<id-model>` (daftar: https://console.groq.com/docs/models). Batas default 30 pesan/hari/user (`DAILY_LIMIT` di `index.ts`).

## 4. Frontend
```bash
cd web
cp .env.example .env     # isi URL dan anon key dari Project Settings > API
npm install
npm run dev              # http://localhost:5173
```
Deploy: Vercel / Netlify / Cloudflare Pages (build `npm run build`, output `dist`, set env yang sama, dan aktifkan SPA fallback ke `index.html`).

## Keamanan
- Hanya pakai **anon key** di frontend. Jangan pernah pakai `service_role` key di browser.
- Semua tabel memakai RLS: user hanya bisa membaca/mengubah datanya sendiri.
- API key Groq hanya ada di Supabase secrets, tidak di frontend.
