import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const Ctx = createContext<(m: string, err?: boolean) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; err: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string, err = false) => {
    setT({ m, err })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setT(null), 3500)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && <div className={`toast${t.err ? ' err' : ''}`} role="status">{t.m}</div>}
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
