import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'need-install' | 'no-key' | 'denied' | 'off' | 'on'

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}
const iosBrowser = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as unknown as { standalone?: boolean }).standalone

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js')
}

/** Status notifikasi di perangkat ini. */
export async function pushState(): Promise<PushState> {
  if (!VAPID) return 'no-key'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return iosBrowser() ? 'need-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesi habis, silakan masuk lagi.')
  const r = await supabase.from('push_subscriptions').upsert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' })
  if (r.error) throw new Error(/relation|does not exist/i.test(r.error.message) ? 'Database belum diperbarui (jalankan migrasi 006_notifications.sql).' : r.error.message)
}

/** Minta izin, daftarkan perangkat ini ke server. */
export async function enablePush() {
  if (!VAPID) throw new Error('Kunci notifikasi (VITE_VAPID_PUBLIC_KEY) belum diisi.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied'
    ? 'Izin notifikasi ditolak. Izinkan lewat pengaturan browser/HP, lalu coba lagi.'
    : 'Izin notifikasi belum diberikan.')
  const reg = await registration()
  if (!reg) throw new Error('Perangkat ini tidak mendukung notifikasi.')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) })
  await save(sub)
}

/** Matikan notifikasi di perangkat ini. */
export async function disablePush() {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Dipanggil saat aplikasi dibuka: pastikan langganan perangkat ini tersimpan atas nama pengguna yang sedang masuk. */
export async function syncPush() {
  try {
    if ((await pushState()) !== 'on') return
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub) await save(sub)
  } catch { /* abaikan */ }
}
