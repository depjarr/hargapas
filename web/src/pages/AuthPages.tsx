import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { recovery } from '../lib/recovery'
import Icon, { Spinner } from '../components/Icon'
import RecoveryCodeCard from '../components/RecoveryCodeCard'
import PasswordChecklist from '../components/PasswordChecklist'
import { passwordProblem } from '../lib/password'

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth">
      <header className="hero">
        <div className="applogo" aria-hidden><Icon n="tag" /></div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </header>
      <div className="box">
        <div className="card">{children}</div>
        <p className="alt">HargaPas · harga jual yang pas</p>
      </div>
    </div>
  )
}

/** Kolom jebakan bot (harus kosong) — disembunyikan dari manusia dan pembaca layar. */
const Honeypot = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input name="hp" tabIndex={-1} autoComplete="off" aria-hidden value={value} onChange={e => onChange(e.target.value)}
    style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
)

export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (!error) return nav('/')
    if (error.message === 'Email not confirmed') setErr('Akun ini belum aktif. Cek email verifikasi kamu.')
    else if (error.message === 'Invalid login credentials') setErr('Email atau password salah.')
    else setErr(error.message)
  }

  return (
    <Shell title="HargaPas" sub="Masuk untuk melanjutkan">
      <form onSubmit={submit}>
        {err && <div className="note bad" role="alert">{err}</div>}
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <div className="row end" style={{ marginTop: -4, marginBottom: 12 }}>
          <Link className="btn ghost sm" to="/lupa-password">Lupa password?</Link>
        </div>
        <button className="btn block" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
        <p className="alt">Belum punya akun? <Link to="/register">Daftar di sini</Link></p>
      </form>
    </Shell>
  )
}

export function Register() {
  const nav = useNavigate()
  const { session, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')

  // halaman ini tidak dibungkus <Public> supaya kode pemulihan sempat ditampilkan setelah daftar
  if (loading) return <Spinner />
  if (session && !busy && !code) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setInfo('')
    const problem = passwordProblem(password, [email, name])
    if (problem) return setErr(problem)
    if (password !== again) return setErr('Ulangi password belum sama.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: location.origin },
    })
    if (error) {
      setBusy(false)
      return setErr(/already registered|already exists/i.test(error.message) ? 'Email ini sudah terdaftar. Coba masuk atau pakai Lupa password.'
        : /weak|pwned|leaked|password/i.test(error.message) ? 'Password terlalu lemah atau pernah bocor. Pakai password lain yang memenuhi semua syarat.' : error.message)
    }
    if (!data.session) {
      // verifikasi email aktif di Supabase: belum ada sesi, kode dibuat nanti di Pengaturan
      setBusy(false)
      return setInfo('Akun dibuat! Cek email dan klik link verifikasi, lalu masuk dan buat kode pemulihan di menu Pengaturan.')
    }
    // buat kode pemulihan (ditampilkan sekali), lalu keluar supaya masuk lagi dengan password
    try {
      const r = await recovery<{ code: string }>({ action: 'issue' })
      if (r?.code) {
        setCode(r.code)
        await supabase.auth.signOut()
      }
    } catch { /* fitur belum aktif: tetap lanjut ke aplikasi */ }
    setBusy(false)
  }

  if (code) return (
    <Shell title="Akun dibuat!" sub="Satu langkah lagi">
      <RecoveryCodeCard code={code} doneLabel="Masuk sekarang" onDone={() => nav('/login', { replace: true })} />
    </Shell>
  )

  return (
    <Shell title="Buat akun" sub="Gratis, cukup email dan password">
      <form onSubmit={submit}>
        {err && <div className="note bad" role="alert">{err}</div>}
        {info && <div className="note ok">{info}</div>}
        <label>Nama<input required value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <PasswordChecklist value={password} />
        <label>Ulangi password<input type="password" required autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
          {again && again !== password && <small className="bad">Belum sama dengan password di atas.</small>}</label>
        <button className="btn block" disabled={busy}>{busy ? 'Mendaftar…' : 'Daftar'}</button>
        <p className="alt">Sudah punya akun? <Link to="/login">Masuk</Link></p>
      </form>
    </Shell>
  )
}

/** Lupa password tanpa email: email + kode pemulihan → password baru, lalu dapat kode baru. */
export function ForgotPassword() {
  const nav = useNavigate()
  const started = useRef(Date.now())
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [hp, setHp] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { document.title = 'Lupa password - HargaPas'; return () => { document.title = 'HargaPas' } }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const problem = passwordProblem(password, [email])
    if (problem) return setErr(problem)
    if (password !== again) return setErr('Ulangi password belum sama.')
    setBusy(true)
    try {
      const r = await recovery<{ ok: boolean; code: string | null }>({
        action: 'reset', email: email.trim().toLowerCase(), code, password, hp, started: started.current,
      })
      setDone(true)
      if (r?.code) setNext(r.code)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Terjadi kesalahan.') }
    setBusy(false)
  }

  if (done && next) return (
    <Shell title="Password diganti!" sub="Kode lama sudah tidak berlaku">
      <RecoveryCodeCard code={next} title="Ini kode pemulihan barumu" doneLabel="Masuk sekarang" onDone={() => nav('/login', { replace: true })} />
    </Shell>
  )
  if (done) return (
    <Shell title="Password diganti!" sub="Silakan masuk dengan password baru">
      <Link className="btn block" to="/login">Masuk sekarang</Link>
    </Shell>
  )

  return (
    <Shell title="Lupa password" sub="Pakai kode pemulihan yang kamu simpan saat daftar">
      <form onSubmit={submit} style={{ position: 'relative' }}>
        {err && <div className="note bad" role="alert">{err}</div>}
        <Honeypot value={hp} onChange={setHp} />
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Kode pemulihan
          <input required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HARGA-XXXX-XXXX"
            className="mono" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
        </label>
        <label>Password baru<input type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <PasswordChecklist value={password} />
        <label>Ulangi password baru<input type="password" required autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
          {again && again !== password && <small className="bad">Belum sama dengan password di atas.</small>}</label>
        <button className="btn block" disabled={busy}>{busy ? 'Memeriksa…' : 'Ganti password'}</button>
        <p className="alt">Kode hilang? Kalau masih bisa masuk, buat kode baru di menu Pengaturan.</p>
        <p className="alt" style={{ marginTop: 6 }}><Link to="/login">Kembali ke halaman masuk</Link></p>
      </form>
    </Shell>
  )
}
