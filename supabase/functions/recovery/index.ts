// @ts-nocheck
// Edge Function: kode pemulihan password (lupa password tanpa email).
//   action "status" (login)  → kapan kode terakhir dibuat
//   action "issue"  (login)  → buat kode baru (kode lama langsung tidak berlaku), kembalikan kode asli SEKALI
//   action "reset"  (publik) → email + kode + password baru → ganti password, lalu beri kode baru
// Kode: HARGA-XXXX-XXXX. Yang disimpan hanya hash PBKDF2-SHA256 + salt.
// Deploy: supabase functions deploy recovery --no-verify-jwt   (aksi "reset" dipakai sebelum login)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---------- kode & hash ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // tanpa 0/O dan 1/I yang mirip
const PREFIX = 'HARGA'
const ITER = 210_000
const MAX_FAIL = 5
const LOCK_MIN = 15

function randInt(n: number) {
  const a = new Uint32Array(1), lim = Math.floor(0x1_0000_0000 / n) * n
  do crypto.getRandomValues(a); while (a[0] >= lim)
  return a[0] % n
}
const generate = () => {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randInt(ALPHABET.length)]).join('')
  return `${PREFIX}-${pick()}-${pick()}`
}
/** Samakan format: huruf besar, tanpa spasi/strip, tanpa awalan HARGA. */
const normalize = (s: string) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(new RegExp('^' + PREFIX), '')
const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map(x => parseInt(x, 16)))

async function derive(code: string, salt: Uint8Array, iter = ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(code)), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256))
}
async function hash(code: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITER}$${toHex(salt)}$${toHex(await derive(code, salt))}`
}
const DUMMY = `pbkdf2$${ITER}$${'00'.repeat(16)}$${'00'.repeat(32)}`
async function matches(code: string, stored: string) {
  let [, it, saltHex, hashHex] = stored.split('$')
  if (!saltHex || !hashHex) [, it, saltHex, hashHex] = DUMMY.split('$')
  const a = await derive(code, fromHex(saltHex), +it || ITER)
  const b = fromHex(hashHex)
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] ?? 0)   // bandingkan tanpa bocor waktu
  return diff === 0
}

async function issue(userId: string, email: string) {
  const code = generate()
  const { error } = await admin.from('recovery_codes').upsert({
    user_id: userId, email: email.toLowerCase(), code_hash: await hash(code),
    created_at: new Date().toISOString(), failed_attempts: 0, locked_until: null,
  })
  if (error) { console.error('[recovery] gagal simpan:', error.message); return null }
  return code
}

async function currentUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data?.user ?? null
}

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60000))

/** Aturan password (sama dengan web/src/lib/password.ts). */
function passwordProblem(p: string, email: string) {
  if (p.length > 72) return 'Password maksimal 72 karakter.'
  if (/^\s|\s$/.test(p)) return 'Password tidak boleh diawali atau diakhiri spasi.'
  const miss: string[] = []
  if (p.length < 8) miss.push('minimal 8 karakter')
  if (!/[A-Z]/.test(p)) miss.push('ada huruf besar')
  if (!/[a-z]/.test(p)) miss.push('ada huruf kecil')
  if (!/[0-9]/.test(p)) miss.push('ada angka')
  if (!/[^A-Za-z0-9\s]/.test(p)) miss.push('ada simbol')
  if (miss.length) return 'Password belum memenuhi syarat: ' + miss.join(', ') + '.'
  const name = email.split('@')[0]
  if (name.length >= 4 && p.toLowerCase().includes(name)) return 'Password jangan memuat nama atau email kamu.'
  return null
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Minta function `push` mengirim peringatan keamanan (tidak mengganggu alur kalau notifikasi belum aktif). */
async function notifySecurity(userId: string, event: 'password_reset' | 'code_created') {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret) return
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({ action: 'security', user_id: userId, event }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) { console.error('[recovery] notifikasi keamanan gagal:', e?.message ?? e) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405)
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action

    // ----- butuh login -----
    if (action === 'status' || action === 'issue') {
      const user = await currentUser(req)
      if (!user?.email) return json({ error: 'Sesi habis, silakan masuk lagi.' }, 401)
      const { data: row } = await admin.from('recovery_codes').select('created_at').eq('user_id', user.id).maybeSingle()
      if (action === 'status') return json({ created_at: row?.created_at ?? null })
      // cegah buat kode berkali-kali dalam waktu singkat
      if (row?.created_at && Date.now() - new Date(row.created_at).getTime() < 60_000)
        return json({ error: 'Tunggu 1 menit dulu sebelum membuat kode baru.' }, 429)
      const code = await issue(user.id, user.email)
      if (code && row?.created_at) await notifySecurity(user.id, 'code_created')   // kode lama diganti
      return code ? json({ code }) : json({ error: 'Gagal membuat kode. Coba lagi sebentar.' }, 500)
    }

    // ----- publik: lupa password -----
    if (action === 'reset') {
      const wrong = json({ error: 'Email atau kode pemulihan salah.' }, 400)
      // jebakan bot: kolom tersembunyi harus kosong & form tidak mungkin diisi < 1,5 detik
      const started = Number(body.started ?? 0)
      if (String(body.hp ?? '') !== '' || (started > 0 && Date.now() - started < 1500)) return wrong

      const email = String(body.email ?? '').trim().toLowerCase()
      const code = String(body.code ?? '')
      const password = String(body.password ?? '')
      if (!EMAIL.test(email)) return json({ error: 'Email belum valid.' }, 400)
      if (normalize(code).length < 8) return json({ error: 'Kode pemulihan belum lengkap.' }, 400)
      const weak = passwordProblem(password, email)
      if (weak) return json({ error: weak }, 400)

      const { data: row } = await admin.from('recovery_codes')
        .select('user_id, code_hash, failed_attempts, locked_until').eq('email', email).maybeSingle()

      if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now())
        return json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${minutes(new Date(row.locked_until).getTime() - Date.now())} menit.` }, 429)

      // tetap hitung hash walau email tidak ada, supaya waktu respons tidak membocorkan apa pun
      const ok = await matches(code, row?.code_hash ?? DUMMY)
      if (!ok || !row) {
        if (row) {
          const fails = (row.failed_attempts ?? 0) + 1
          const lock = fails >= MAX_FAIL
          await admin.from('recovery_codes').update({
            failed_attempts: lock ? 0 : fails,
            locked_until: lock ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : null,
          }).eq('user_id', row.user_id)
          const left = MAX_FAIL - fails
          if (lock) return json({ error: `Terlalu banyak percobaan salah. Dikunci ${LOCK_MIN} menit.` }, 429)
          if (left <= 2) return json({ error: `Email atau kode pemulihan salah. Sisa ${left} percobaan sebelum dikunci ${LOCK_MIN} menit.` }, 400)
        }
        return wrong
      }

      const { error } = await admin.auth.admin.updateUserById(row.user_id, { password })
      if (error) {
        console.error('[recovery] gagal ganti password:', error.message)
        if (/weak|pwned|leaked/i.test(error.message)) return json({ error: 'Password ini terlalu umum atau pernah bocor. Pakai password lain ya.' }, 400)
        return json({ error: 'Gagal menyimpan password baru. Coba lagi sebentar.' }, 500)
      }
      await notifySecurity(row.user_id, 'password_reset')
      // kode lama hangus, ganti dengan yang baru
      const next = await issue(row.user_id, email)
      return json({ ok: true, code: next })
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400)
  } catch (e) {
    console.error('[recovery]', e)
    return json({ error: 'Terjadi kesalahan di server.' }, 500)
  }
})
