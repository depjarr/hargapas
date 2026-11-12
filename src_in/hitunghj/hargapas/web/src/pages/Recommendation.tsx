import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { must, useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { calcWithGroup } from '../lib/calc'
import { buildContext } from '../lib/aiContext'
import { fnErrorMessage } from '../lib/fn'
import PriceResult from '../components/PriceResult'
import MarginInputs from '../components/MarginInputs'
import Icon, { Spinner } from '../components/Icon'

export default function Recommendation() {
  const d = useData()
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const p = d.products.find(x => x.id === sp.get('p')) ?? d.products[0]
  const [comp, setComp] = useState('')
  const [aud, setAud] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setComp(p?.competitor_price ? String(p.competitor_price) : '')
    setAud(p?.aud ?? '')
    setOut('')
  }, [p?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading) return <Spinner />
  if (!p) return (
    <div className="card empty">
      <span className="ico c-purple"><Icon n="bulb" /></span>
      <p>Tambahkan produk terlebih dahulu.</p>
      <Link className="btn" to="/kalkulator"><Icon n="plus" />Tambah produk</Link>
    </div>
  )

  const c = calcWithGroup(p, d.products, d.groups)

  async function patch(values: Record<string, unknown>) {
    try { must(await supabase.from('products').update(values).eq('id', p!.id)); await d.reload() }
    catch (e) { toast(e instanceof Error ? e.message : 'Gagal menyimpan.', true) }
  }

  async function analyze() {
    setBusy(true); setOut('Menganalisis…')
    try {
      const prompt = `Analisis produk "${p!.name}": harga rekomendasi (rumus: harga jual = HPP + target untung % × HPP), persen untung yang disarankan, saran harga kompetitif, risiko harga, dan peluang laba. Gunakan tool simulasi untuk angka.`
      const { data, error } = await supabase.functions.invoke('ai-consultant', {
        body: { messages: [{ role: 'user', content: prompt }], context: buildContext(d.products, d.groups) },
      })
      if (error) throw new Error(await fnErrorMessage(error, 'Gagal menghubungi konsultan AI.'))
      setOut(data.reply)
    } catch (e) { setOut('Gagal: ' + (e instanceof Error ? e.message : 'terjadi kesalahan')) }
    setBusy(false)
  }

  return (
    <div className="split">
      <div>
        <div className="cap" style={{ marginTop: 0 }}>Produk</div>
        <div className="form">
          <label className="fld">
            <span>Produk</span>
            <select value={p.id} onChange={e => setSp({ p: e.target.value })}>
              {d.products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="fld">
            <span>Harga pesaing</span>
            <input type="number" inputMode="decimal" min="0" placeholder="Opsional" value={comp} onChange={e => setComp(e.target.value)}
              onBlur={() => { if ((+comp || null) !== (p.competitor_price || null)) patch({ competitor_price: +comp || null }) }} />
          </label>
          <label className="fld">
            <span>Target pelanggan</span>
            <input value={aud} placeholder="Opsional" onChange={e => setAud(e.target.value)}
              onBlur={() => { if (aud !== (p.aud ?? '')) patch({ aud: aud.trim() || null }) }} />
          </label>
        </div>

        <div className="cap">Target untung (% dari HPP)</div>
        <MarginInputs />

        <div className="cap">Analisis AI</div>
        <div className="card">
          <button className="btn block soft" disabled={busy} onClick={analyze}><Icon n="spark" />{busy ? 'Menganalisis…' : 'Analisis harga produk ini'}</button>
          {out && <div className="msg a" style={{ marginTop: 12, maxWidth: '100%' }}>{out}</div>}
        </div>
      </div>

      <div className="sticky">
        <div className="cap" style={{ marginTop: 0 }}>Hasil</div>
        <PriceResult c={c} sell={p.sell_price} margins={d.margins}
          onUse={async price => { await patch({ sell_price: price }); toast('Harga jual diperbarui') }} />
      </div>
    </div>
  )
}
