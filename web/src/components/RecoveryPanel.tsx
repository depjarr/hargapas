import { useEffect, useState } from 'react'
import { recovery } from '../lib/recovery'
import RecoveryCodeCard from './RecoveryCodeCard'
import Icon from './Icon'
import { useConfirm } from '../lib/confirm'

/** Pengaturan: lihat status & buat kode pemulihan baru (untuk akun lama, atau bila kodenya hilang). */
export default function RecoveryPanel() {
  const [since, setSince] = useState<string | null | undefined>(undefined)   // undefined = memuat
  const [off, setOff] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = useConfirm()

  useEffect(() => {
    recovery<{ created_at: string | null }>({ action: 'status' })
      .then(r => setSince(r?.created_at ?? null))
      .catch(() => { setOff(true); setSince(null) })
  }, [])

  async function make() {
    if (since && !(await ask({ title: 'Buat kode baru?', message: 'Kode pemulihan yang lama langsung tidak berlaku lagi.', confirmLabel: 'Buat kode baru' }))) return
    setErr(''); setBusy(true)
    try {
      const r = await recovery<{ code: string }>({ action: 'issue' })
      setCode(r.code); setSince(new Date().toISOString()); setOff(false)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal membuat kode.') }
    setBusy(false)
  }

  if (code) return <div className="card"><RecoveryCodeCard code={code} onDone={() => setCode('')} /></div>

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center', gap: 12 }}>
        <span className="ico sm c-blue"><Icon n="key" /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontWeight: 600 }}>Kode pemulihan</b>
          <small>
            {since === undefined ? 'Memeriksa…'
              : off ? 'Fitur belum aktif di server (Edge Function "recovery" belum di-deploy).'
              : since ? `Aktif sejak ${new Date(since).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}. Dipakai kalau lupa password.`
              : 'Belum ada. Buat sekarang supaya bisa ganti password kalau lupa.'}
          </small>
        </span>
        <button type="button" className="btn sm" disabled={busy || since === undefined} onClick={make}>
          {busy ? '…' : since ? 'Buat baru' : 'Buat kode'}
        </button>
      </div>
      {err && <p className="bad" role="alert" style={{ marginTop: 10, marginBottom: 0 }}>{err}</p>}
    </div>
  )
}
