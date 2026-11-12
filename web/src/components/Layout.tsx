import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { DataProvider, useData } from '../lib/data'
import { ToastProvider } from '../lib/toast'
import { ConfirmProvider } from '../lib/confirm'
import { syncPush } from '../lib/push'
import { dd } from '../lib/format'
import Icon from './Icon'

/** [path, ikon, label pendek (tab/rail), judul halaman, subjudul, warna ubin] */
export const NAV: [string, string, string, string, string, string][] = [
  ['/', 'home', 'Beranda', 'Dashboard', '', 'blue'],
  ['/kalkulator', 'calc', 'Hitung', 'Kalkulator Harga', 'Hitung HPP dan harga jual per produk', 'orange'],
  ['/produk', 'box', 'Produk', 'Produk Saya', 'Semua produk yang sudah kamu simpan', 'green'],
  ['/rekomendasi', 'bulb', 'Saran', 'Rekomendasi Harga', 'Harga jual sesuai target untung', 'purple'],
  ['/konsultan', 'chat', 'Konsultan', 'Konsultan AI', 'Tanya strategi harga ke AI', 'pink'],
  ['/laporan', 'chart', 'Laporan', 'Laporan', 'Rekap laba dan unduh CSV', 'teal'],
  ['/pengaturan', 'gear', 'Atur', 'Pengaturan', 'Target untung dan data akun', 'blue'],
]
const MORE = ['/konsultan', '/laporan', '/pengaturan']

function Shell() {
  const { session } = useAuth()
  const { profile } = useData()
  const { pathname } = useLocation()
  const [more, setMore] = useState(false)
  const cur = NAV.find(n => n[0] !== '/' && pathname.startsWith(n[0])) ?? NAV[0]
  const name = profile?.display_name || session?.user.email || ''
  const initial = (name[0] || '?').toUpperCase()
  const sub = cur[0] === '/' ? `Update terakhir ${dd(new Date().toISOString())}` : cur[4]

  useEffect(() => { setMore(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { syncPush() }, [session?.user.id])   // simpan ulang langganan notifikasi perangkat ini
  useEffect(() => {
    if (!more) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [more])

  const logout = () => supabase.auth.signOut()
  const tab = (to: string, icon: string, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon n={icon} /><span>{label}</span>
    </NavLink>
  )

  return (
    <div className="app">
      {/* Tablet & laptop: sidebar */}
      <aside className="side" aria-label="Menu utama">
        <div className="panel">
          <Link to="/" className="mark"><span className="logo"><Icon n="tag" /></span><span className="name">HargaPas</span></Link>
          <nav>
            {NAV.map(([to, icon, short, title]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')} title={title}>
                <Icon n={icon} /><span className="hide-tablet">{title}</span><span className="hide-phone hide-desktop">{short}</span>
              </NavLink>
            ))}
          </nav>
          <div className="me">
            <span className="avatar" aria-hidden>{initial}</span>
            <span className="email">{name}</span>
            <button className="nav" onClick={logout} title="Keluar" aria-label="Keluar"><Icon n="logout" /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="hero">
          <div className="hero-top">
            <span className="mark"><span className="logo"><Icon n="tag" /></span>HargaPas</span>
            <span />
            <Link to="/pengaturan" className="avatar" aria-label="Akun dan pengaturan">{initial}</Link>
          </div>
          <h1>{cur[3]}</h1>
          <p>{sub}</p>
        </header>
        <div className="sheet"><Outlet /></div>
      </main>

      {/* HP: tab bar bawah dengan tombol tengah */}
      <nav className="tabbar" aria-label="Navigasi">
        {tab('/', 'home', 'Beranda')}
        {tab('/produk', 'box', 'Produk')}
        <NavLink to="/kalkulator" className={({ isActive }) => `fab${isActive ? ' active' : ''}`} aria-label="Kalkulator harga">
          <Icon n="plus" />
        </NavLink>
        {tab('/rekomendasi', 'bulb', 'Saran')}
        <button className={MORE.some(m => pathname.startsWith(m)) ? 'active' : ''} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Icon n="more" /><span>Lainnya</span>
        </button>
      </nav>

      {more && (
        <>
          <div className="scrim" onClick={() => setMore(false)} />
          <div className="asheet" role="dialog" aria-label="Menu lainnya">
            <div className="group">
              {NAV.filter(n => MORE.includes(n[0])).map(([to, icon, , title, , color]) => (
                <Link key={to} to={to} className="li">
                  <span className={`ico sm c-${color}`}><Icon n={icon} /></span><span className="grow">{title}</span><Icon n="right" className="i chev" />
                </Link>
              ))}
              <button className="li danger" onClick={logout}>
                <span className="ico sm c-red"><Icon n="logout" /></span><span className="grow">Keluar</span>
              </button>
            </div>
            <button className="cancel" onClick={() => setMore(false)}>Batal</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <DataProvider>
          <Shell />
        </DataProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
