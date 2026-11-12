// @ts-nocheck
// Edge Function: baca foto struk/faktur/tangkapan layar e-commerce (Groq vision).
import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = 30 // dihitung bersama pemakaian Konsultan AI
// llama-4-scout sudah dihapus dari Groq; qwen3.8-27b bisa membaca gambar
const MODEL = Deno.env.get('GROQ_VISION_MODEL') ?? 'qwen/qwen3.8-27b'
/** Jelaskan error dari Groq dalam bahasa sederhana (ditampilkan ke pengguna, tanpa membocorkan kunci). */
function groqReason(status: number, body: string) {
  let msg = ''
  try { msg = JSON.parse(body)?.error?.message ?? '' } catch { msg = body }
  msg = String(msg).replace(/gsk_[A-Za-z0-9]+/g, 'gsk_***').slice(0, 160)
  if (status === 401) return 'Kunci GROQ_API_KEY di Supabase tidak valid. Periksa lagi di Edge Functions > Secrets (tanpa spasi/enter).'
  if (status === 404 || /model.*(not exist|not found|decommission)/i.test(msg)) return `Model AI tidak tersedia di Groq (${msg}).`
  if (status === 413 || /too large|tokens per minute|TPM/i.test(msg)) return 'Data yang dikirim ke AI terlalu besar untuk batas akun Groq. Coba lagi sebentar.'
  if (status === 429) return 'Konsultan AI sedang ramai (batas Groq tercapai). Coba lagi sebentar.'
  return `Groq menolak permintaan (kode ${status}${msg ? ': ' + msg : ''}).`
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT =
  'Ekstrak semua baris pembelian dari gambar struk, faktur, atau tangkapan layar e-commerce ini. ' +
  'Balas HANYA JSON: {"items":[{"name":string,"qty":number (jumlah pcs di baris itu),"total":number (total Rupiah baris itu setelah diskon; diskon atau voucher berupa angka negatif),' +
  '"kind":"barang"|"ongkir"|"biaya"|"diskon"}],"total":number|null,"supplier":string|null}. ' +
  'Hanya isi yang benar-benar terbaca; pakai null jika tidak terbaca. Jangan menebak.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Belum login.' }, 401)
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return json({ error: 'Sesi tidak valid. Silakan login lagi.' }, 401)

    const since = new Date(); since.setUTCHours(0, 0, 0, 0)
    const { count } = await sb.from('ai_usage').select('id', { count: 'exact', head: true }).gte('created_at', since.toISOString())
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Batas ${DAILY_LIMIT} permintaan AI per hari sudah tercapai. Coba lagi besok.` }, 429)

    const { image } = await req.json()
    if (typeof image !== 'string' || !image.startsWith('data:image/')) return json({ error: 'Gambar tidak valid.' }, 400)
    if (image.length > 5_000_000) return json({ error: 'Gambar terlalu besar. Coba foto yang lebih kecil.' }, 413)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_completion_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      console.error('Groq vision error', res.status, t)
      return json({ error: 'Pembacaan gambar gagal: ' + groqReason(res.status, t) + ' Anda tetap bisa mengisi manual.' }, 502)
    }
    const text = (await res.json()).choices?.[0]?.message?.content ?? ''
    let parsed: any = null
    try { parsed = JSON.parse(text) } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* abaikan */ } }
    }
    if (!parsed) return json({ items: [], total: null, supplier: null })

    const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 40).map((x: any) => ({
      name: String(x?.name ?? '').slice(0, 120),
      qty: +x?.qty > 0 ? +x.qty : 1,
      total: +x?.total || 0,
      kind: ['barang', 'ongkir', 'biaya', 'diskon'].includes(x?.kind) ? x.kind : 'biaya',
    }))
    await sb.from('ai_usage').insert({ user_id: user.id })
    return json({ items, total: parsed.total ?? null, supplier: parsed.supplier ?? null })
  } catch (e) {
    console.error(e)
    return json({ error: 'Terjadi kesalahan di server.' }, 500)
  }
})