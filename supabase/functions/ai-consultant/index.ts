// @ts-nocheck
// Edge Function: Konsultan AI (Groq) dengan tool "simulasi" seperti di HTML:
// semua angka harga/diskon/target laba dihitung oleh kode, bukan oleh AI.
import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = 30
const MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b'
const FALLBACK_MODEL = 'openai/gpt-oss-20b'   // dipakai kalau model utama tidak tersedia
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYSTEM =
  'Kamu konsultan harga untuk UMKM Indonesia. Jawab dalam Bahasa Indonesia sederhana, ringkas, dan praktis. ' +
  'Jangan mengarang harga pesaing atau data pasar; jika tidak ada, katakan analisis hanya berdasarkan biaya dan target pengguna. ' +
  'Untuk semua angka simulasi (harga, diskon, target laba) WAJIB pakai tool simulasi, jangan hitung sendiri.'

// harga dibulatkan ke rupiah terdekat (sama dengan aplikasi, tanpa pembulatan ...900)
const psy = (P: number) => Math.round(P)

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

const TOOLS = [{
  type: 'function',
  function: {
    name: 'simulasi',
    description: 'Hitung laba dan margin nyata untuk satu produk pada harga jual tertentu, setelah diskon persen, atau untuk target laba bersih per unit.',
    parameters: {
      type: 'object',
      properties: {
        produk: { type: 'string', description: 'Nama produk (boleh sebagian)' },
        harga: { type: 'number', description: 'Harga jual (Rp)' },
        diskon_persen: { type: 'number' },
        target_laba_per_unit: { type: 'number', description: 'Target laba bersih per unit (Rp)' },
      },
      required: ['produk'],
    },
  },
}]

function simulasi(ctx: any[], i: any) {
  const q = String(i.produk ?? '').toLowerCase()
  const p = ctx.find((x) => String(x.nama ?? '').toLowerCase().includes(q)) ?? ctx[0]
  if (!p) return { error: 'Belum ada produk' }
  const hpp = +p.hpp || 0
  const f = (+p.biaya_persen || 0) / 100
  let pr = +i.harga || +p.harga_jual || 0
  if (i.target_laba_per_unit != null) pr = psy((hpp + +i.target_laba_per_unit) / (1 - f))
  if (i.diskon_persen) pr = pr * (1 - +i.diskon_persen / 100)
  const gross = pr - hpp, fee = pr * f, net = gross - fee
  return {
    produk: p.nama, harga: Math.round(pr), hpp: Math.round(hpp), laba_kotor: Math.round(gross),
    biaya_persen: Math.round(fee), laba_bersih: Math.round(net),
    margin: +(pr ? (net / pr) * 100 : 0).toFixed(2), markup: +(hpp ? (net / hpp) * 100 : 0).toFixed(2),
    harga_impas: f < 1 ? Math.round(hpp / (1 - f)) : null,
  }
}

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

    const body = await req.json()
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    while (messages.length && messages[0].role !== 'user') messages.shift()
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'Pesan tidak valid.' }, 400)

    const ctxArr = Array.isArray(body.context) ? body.context.slice(0, 60) : []
    const chat: any[] = [
      { role: 'system', content: `${SYSTEM}\n\nData aplikasi saat ini (JSON):\n${JSON.stringify(ctxArr).slice(0, 20000)}` },
      ...messages,
    ]

    let reply = ''
    let useTools = true
    let model = MODEL
    for (let round = 0; round < 5; round++) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: 1500,
          temperature: 0.3,
          ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
          ...(useTools ? { tools: TOOLS } : {}),
          messages: chat,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        console.error('Groq error', res.status, t)
        if (useTools && res.status === 400 && t.includes('tool_use_failed')) { useTools = false; continue } // coba lagi tanpa tool
        if (model !== FALLBACK_MODEL && (res.status === 404 || /model/i.test(t) && /not exist|not found|decommission/i.test(t))) { model = FALLBACK_MODEL; continue }
        return json({ error: groqReason(res.status, t) }, 502)
      }
      const msg = (await res.json()).choices?.[0]?.message
      const calls = msg?.tool_calls ?? []
      if (useTools && calls.length) {
        chat.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls })
        for (const tc of calls) {
          let args = {}
          try { args = JSON.parse(tc.function?.arguments || '{}') } catch { /* abaikan */ }
          let out
          try { out = tc.function?.name === 'simulasi' ? simulasi(ctxArr, args) : { error: 'Tool tidak dikenal' } }
          catch (e) { out = { error: String(e?.message ?? e) } }
          chat.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) })
        }
        continue
      }
      reply = (msg?.content ?? '').trim()
      break
    }
    if (!reply) return json({ error: 'AI tidak memberi jawaban. Coba tanya dengan kalimat lain.' }, 502)

    await sb.from('ai_usage').insert({ user_id: user.id })
    return json({ reply, remaining: DAILY_LIMIT - (count ?? 0) - 1 })
  } catch (e) {
    console.error(e)
    return json({ error: 'Terjadi kesalahan di server.' }, 500)
  }
})