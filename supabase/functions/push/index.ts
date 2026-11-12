// @ts-nocheck
// Edge Function: notifikasi HargaPas (Web Push).
//   action "test"     (login)              → kirim notifikasi uji ke semua perangkat milik pengguna
//   action "weekly"   (header x-cron-secret) → ringkasan mingguan untuk semua pengguna (dipanggil pg_cron tiap Senin)
//   action "security" (header x-cron-secret) → peringatan keamanan akun (dipanggil function `recovery`)
// Deploy: supabase functions deploy push --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (lihat supabase/functions/.env)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

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
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@hargapas.app', VAPID_PUBLIC, VAPID_PRIVATE)
}

type Payload = { title: string; body: string; url?: string; tag?: string }
type Kind = 'test' | 'weekly' | 'security'

/** Kirim ke semua perangkat pengguna (menghormati pilihan notifikasinya). Langganan yang sudah mati dihapus. */
async function sendToUser(userId: string, p: Payload, kind: Kind) {
  if (kind !== 'test') {
    const { data: s } = await admin.from('notification_settings').select('weekly_summary, security_alerts').eq('user_id', userId).maybeSingle()
    if (kind === 'weekly' && s && !s.weekly_summary) return 0
    if (kind === 'security' && s && !s.security_alerts) return 0
  }
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 60 * 60 * 24, urgency: kind === 'security' ? 'high' : 'normal' })
      sent++
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (e) {
      const code = e?.statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)   // izin dicabut / HP sudah ganti
      else console.error('[push] gagal kirim', code, e?.body ?? e?.message)
    }
  }
  return sent
}

// ---------- ringkasan mingguan (rumus sama dengan web/src/lib/calc.ts) ----------
const rp = (n: number) => (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n)).toLocaleString('id-ID')

async function weeklyFor(userId: string): Promise<Payload | null> {
  const [{ data: products }, { data: groups }] = await Promise.all([
    admin.from('products').select('id, name, qty, sell_price, group_id, product_costs(type, value, category)').eq('user_id', userId),
    admin.from('cost_groups').select('id, cost_group_items(value)').eq('user_id', userId),
  ])
  if (!products?.length) return null
  const gTotal = new Map((groups ?? []).map(g => [g.id, (g.cost_group_items ?? []).reduce((s, i) => s + (+i.value || 0), 0)]))
  const gQty = new Map<string, number>()
  for (const p of products) if (p.group_id) gQty.set(p.group_id, (gQty.get(p.group_id) ?? 0) + (+p.qty || 0))

  let sumUntung = 0, priced = 0, totalNet = 0
  const low: string[] = []
  for (const p of products) {
    const sq = +p.qty || 1
    let cost = 0, pct = 0
    for (const c of p.product_costs ?? []) {
      if (c.type === 'pct') pct += (+c.value || 0) / 100
      else cost += c.type === 'unit' ? (+c.value || 0) * sq : +c.value || 0
    }
    if (p.group_id && gQty.get(p.group_id)) cost += ((gTotal.get(p.group_id) ?? 0) / gQty.get(p.group_id)!) * sq
    const hpp = cost / sq
    const price = +p.sell_price || 0
    if (!price || !hpp) continue
    const net = price - hpp - price * pct
    const untung = (net / hpp) * 100
    priced++; sumUntung += untung; totalNet += net * sq
    if (untung < 10) low.push(p.name)
  }
  if (!priced) return null
  const avg = (sumUntung / priced).toFixed(1).replace('.', ',')
  let body = `${products.length} produk · rata-rata untung ${avg}% · estimasi total untung ${rp(totalNet)}.`
  if (low.length) body += ` ${low.length} produk untungnya di bawah 10%: ${low.slice(0, 3).join(', ')}${low.length > 3 ? ', …' : ''}.`
  else body += ' Semua produk untungnya sehat 👍'
  return { title: 'Ringkasan mingguan HargaPas', body, url: '/laporan', tag: 'weekly' }
}

const SECURITY: Record<string, Payload> = {
  password_reset: { title: 'Password akunmu baru saja diganti', body: 'Password diganti lewat kode pemulihan. Kalau ini bukan kamu, segera ganti password dan buat kode pemulihan baru di Pengaturan.', url: '/pengaturan', tag: 'security' },
  code_created: { title: 'Kode pemulihan baru dibuat', body: 'Kode pemulihan yang lama sudah tidak berlaku. Kalau ini bukan kamu, segera ganti password di Pengaturan.', url: '/pengaturan', tag: 'security' },
}

async function currentUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data?.user ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405)
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'Notifikasi belum diaktifkan di server (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum diisi di Secrets).' }, 503)
  try {
    const body = await req.json().catch(() => ({}))
    const fromCron = CRON_SECRET !== '' && req.headers.get('x-cron-secret') === CRON_SECRET

    if (body.action === 'test') {
      const user = await currentUser(req)
      if (!user) return json({ error: 'Sesi habis, silakan masuk lagi.' }, 401)
      const sent = await sendToUser(user.id, { title: 'Notifikasi HargaPas aktif ✅', body: 'Kamu akan menerima ringkasan mingguan dan peringatan keamanan akun di perangkat ini.', url: '/pengaturan', tag: 'test' }, 'test')
      return sent ? json({ sent }) : json({ error: 'Tidak ada perangkat yang terdaftar. Nyalakan notifikasi dulu di perangkat ini.' }, 404)
    }

    if (!fromCron) return json({ error: 'Tidak diizinkan.' }, 401)

    if (body.action === 'security') {
      const p = SECURITY[body.event]
      if (!p || !body.user_id) return json({ error: 'Data tidak lengkap.' }, 400)
      return json({ sent: await sendToUser(String(body.user_id), p, 'security') })
    }

    if (body.action === 'weekly') {
      const { data: rows } = await admin.from('push_subscriptions').select('user_id')
      const users = [...new Set((rows ?? []).map(r => r.user_id))]
      let sent = 0
      for (const uid of users) {
        try {
          const p = await weeklyFor(uid)
          if (p) sent += await sendToUser(uid, p, 'weekly')
        } catch (e) { console.error('[push] ringkasan gagal untuk', uid, e) }
      }
      return json({ users: users.length, sent })
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400)
  } catch (e) {
    console.error('[push]', e)
    return json({ error: 'Terjadi kesalahan di server.' }, 500)
  }
})
