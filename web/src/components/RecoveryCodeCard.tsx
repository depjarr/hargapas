import { useState } from 'react'
import Icon from './Icon'

/** Simpan kode sebagai gambar PNG (digambar langsung di canvas, tanpa library). */
function saveImage(code: string) {
  const W = 900, H = 520, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#3a46f2'); bg.addColorStop(1, '#1d24c9')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(W - 80, 40, 200, 0, Math.PI * 2); g.fill()
  g.textAlign = 'center'; g.fillStyle = '#fff'
  g.font = '700 40px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText('HargaPas', W / 2, 110)
  g.font = '500 26px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'
  g.fillText('Kode pemulihan password', W / 2, 160)
  g.fillStyle = '#fff'
  const bx = 90, by = 210, bw = W - 180, bh = 120, r = 28
  g.beginPath(); g.moveTo(bx + r, by); g.arcTo(bx + bw, by, bx + bw, by + bh, r); g.arcTo(bx + bw, by + bh, bx, by + bh, r)
  g.arcTo(bx, by + bh, bx, by, r); g.arcTo(bx, by, bx + bw, by, r); g.fill()
  g.fillStyle = '#1d24c9'; g.font = '800 58px ui-monospace, Consolas, Menlo, monospace'; g.fillText(code, W / 2, by + 82)
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '500 22px system-ui, -apple-system, Segoe UI, sans-serif'
  g.fillText('Dipakai kalau lupa password. Jangan bagikan ke siapa pun.', W / 2, 400)
  g.fillText(`Dibuat ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 440)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = 'kode-pemulihan-hargapas.png'
  a.click()
}

/**
 * Menampilkan kode pemulihan sekali: salin / simpan gambar,
 * dan tombol lanjut baru aktif setelah dicentang "sudah menyimpan".
 */
export default function RecoveryCodeCard({ code, title = 'Simpan kode pemulihanmu', doneLabel = 'Selesai', onDone }: {
  code: string; title?: string; doneLabel?: string; onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* abaikan */ }
  }

  return (
    <div className="rcard">
      <div className="rcode">
        <span className="ico c-blue"><Icon n="key" /></span>
        <h2>{title}</h2>
        <p className="mu">Kode ini dipakai kalau kamu lupa password. Hanya ditampilkan <b>sekali</b>, jadi simpan baik-baik ya.</p>
        <output className="code" aria-label={`Kode pemulihan ${code.split('').join(' ')}`}>{code}</output>
      </div>
      <div className="grid g2" style={{ gap: 10 }}>
        <button type="button" className="btn soft" onClick={copy}><Icon n={copied ? 'check' : 'copy'} />{copied ? 'Tersalin' : 'Salin'}</button>
        <button type="button" className="btn soft" onClick={() => saveImage(code)}><Icon n="download" />Simpan gambar</button>
      </div>
      <label className="confirm">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
        Aku sudah menyimpan kode ini
      </label>
      <button type="button" className="btn block" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  )
}
