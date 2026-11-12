import { useEffect, useState } from 'react'

/** Event "pasang aplikasi" dari Chrome/Edge (Android & laptop). Ditangkap sedini mungkin di main.tsx. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(f => f())

export function setupPwa() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* abaikan */ }) })
  }
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Status & aksi pasang aplikasi. */
export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force(x => x + 1)
    listeners.add(f)
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener?.('change', f)
    return () => { listeners.delete(f); mq.removeEventListener?.('change', f) }
  }, [])
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIOS(),
    async install() {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      notify()
      return outcome === 'accepted'
    },
  }
}
