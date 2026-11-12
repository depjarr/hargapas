import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useInstall } from '../lib/pwa'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { fnErrorMessage } from '../lib/fn'
import Icon from './Icon'

interface Prefs { weekly_summary: boolean; security_alerts: boolean }

/** Saklar gaya iOS. */
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}><i /></button>
  )
}

/** Pengaturan: pasang aplikasi + notifikasi. */
export default function AppPanel() {
  const toast = useToast()
  const ins = useInstall()
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [prefs, setPrefs] = useState<Prefs>({ weekly_summary: true, security_alerts: true })
  const [busy, setBusy] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'))
    supabase.from('notification_settings').select('weekly_summary, security_alerts').maybeSingle()
      .then(({ data }) => { if (data) setPrefs(data as Prefs) })
  }, [])

  async function toggleDevice(v: boolean) {
    setBusy(true)
    try {
      if (v) { await enablePush(); toast('Notifikasi aktif di perangkat ini') }
      else { await disablePush(); toast('Notifikasi dimatikan di perangkat ini') }
    } catch (e) { toast(e instanceof Error ? e.message : 'Gagal mengatur notifikasi.', true) }
    setState(await pushState())
    setBusy(false)
  }

  async function setPref(k: keyof Prefs, v: boolean) {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    const { data: { user } } = await supabase.auth.getUser()
    const r = await supabase.from('notification_settings').upsert({ user_id: user?.id, ...next, updated_at: new Date().toISOString() })
    if (r.error) { setPrefs(prefs); toast(r.error.message, true) }
  }

  async function test() {
    setBusy(true)
    try {
      const { error } = await supabase.functions.invoke('push', { body: { action: 'test' } })
      if (error) throw new Error(await fnErrorMessage(error, 'Gagal mengirim notifikasi uji.'))
      toast('Notifikasi uji dikirim. Cek bilah notifikasi HP-mu.')
    } catch (e) { toast(e instanceof Error ? e.message : 'Gagal mengirim notifikasi uji.', true) }
    setBusy(false)
  }

  const on = state === 'on'

  return (
    <>
      {/* ---------- Pasang aplikasi ---------- */}
      <div className="card appcard">
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <img src="/icons/icon-192.png" alt="" width={52} height={52} style={{ borderRadius: 13, flex: 'none' }} />
          <span style={{ flex: '1 1 170px', minWidth: 0 }}>
            <b style={{ display: 'block', fontWeight: 600 }}>Aplikasi HargaPas</b>
            <small>{ins.installed ? 'Sudah terpasang di perangkat ini ✓' : 'Pasang di layar utama: buka lebih cepat, tampil layar penuh, dan bisa menerima notifikasi.'}</small>
          </span>
          {!ins.installed && ins.canPrompt && (
            <button type="button" className="btn sm" onClick={async () => { if (await ins.install()) toast('HargaPas terpasang 🎉') }}>
              <Icon n="download" />Pasang
            </button>
          )}
          {!ins.installed && !ins.canPrompt && (
            <button type="button" className="btn sm soft" onClick={() => setShowIosHelp(s => !s)} aria-expanded={showIosHelp}>Cara pasang</button>
          )}
        </div>
        {showIosHelp && !ins.installed && (
          <ol className="howto">
            {ins.ios ? (
              <>
                <li>Buka HargaPas di <b>Safari</b>.</li>
                <li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li>
                <li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>
                <li>Buka HargaPas dari ikon di layar utama.</li>
              </>
            ) : (
              <>
                <li>Buka HargaPas di <b>Chrome</b> atau <b>Edge</b>.</li>
                <li>Ketuk menu <b>⋮</b> di pojok kanan atas.</li>
                <li>Pilih <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.</li>
              </>
            )}
          </ol>
        )}
      </div>

      {/* ---------- Notifikasi ---------- */}
      <div className="form">
        <div className="fld">
          <span className="ico sm c-blue"><Icon n="bell" /></span>
          <span style={{ flex: 1, minWidth: 0, maxWidth: 'none' }}>
            Notifikasi di perangkat ini
            <small style={{ display: 'block' }}>
              {state === 'loading' ? 'Memeriksa…'
                : state === 'on' ? 'Aktif'
                : state === 'denied' ? 'Diblokir. Izinkan di pengaturan browser/HP.'
                : state === 'need-install' ? 'Di iPhone: pasang aplikasi dulu (iOS 16.4+).'
                : state === 'unsupported' ? 'Browser ini tidak mendukung notifikasi.'
                : state === 'no-key' ? 'Belum diaktifkan di server.'
                : 'Mati'}
            </small>
          </span>
          <Switch label="Notifikasi di perangkat ini" on={on} disabled={busy || !['on', 'off'].includes(state)} onChange={toggleDevice} />
        </div>
        <div className="fld">
          <span className="ico sm c-teal"><Icon n="chart" /></span>
          <span style={{ flex: 1, minWidth: 0, maxWidth: 'none' }}>Ringkasan mingguan<small style={{ display: 'block' }}>Tiap Senin pukul 08.00 WIB</small></span>
          <Switch label="Ringkasan mingguan" on={prefs.weekly_summary} onChange={v => setPref('weekly_summary', v)} />
        </div>
        <div className="fld">
          <span className="ico sm c-red"><Icon n="key" /></span>
          <span style={{ flex: 1, minWidth: 0, maxWidth: 'none' }}>Keamanan akun<small style={{ display: 'block' }}>Saat password diganti / kode pemulihan dibuat</small></span>
          <Switch label="Keamanan akun" on={prefs.security_alerts} onChange={v => setPref('security_alerts', v)} />
        </div>
        {on && (
          <button type="button" className="li addrow" disabled={busy} onClick={test}><Icon n="send" /> Kirim notifikasi uji</button>
        )}
      </div>
      <p className="foot">
        Suara, getar, dan tampilan notifikasi bisa diatur di <b>Pengaturan HP → Aplikasi → HargaPas → Notifikasi</b> (setelah aplikasi dipasang).
      </p>
    </>
  )
}
