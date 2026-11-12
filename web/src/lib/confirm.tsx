import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean          // tombol konfirmasi merah (untuk hapus)
}
type Ask = (o: ConfirmOptions) => Promise<boolean>

const Ctx = createContext<Ask>(async () => false)

/** Dialog konfirmasi gaya iOS (pengganti window.confirm). Pakai: `if (!(await confirm({...}))) return` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opt, setOpt] = useState<ConfirmOptions | null>(null)
  const [closing, setClosing] = useState(false)
  const resolver = useRef<(v: boolean) => void>(() => {})
  const okBtn = useRef<HTMLButtonElement>(null)
  const cancelBtn = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>(o => new Promise<boolean>(res => {
    resolver.current = res
    setClosing(false)
    setOpt(o)
  }), [])

  const close = useCallback((v: boolean) => {
    setClosing(true)
    window.setTimeout(() => { setOpt(null); setClosing(false); resolver.current(v) }, 160)
  }, [])

  useEffect(() => {
    if (!opt) return
    const prev = document.activeElement as HTMLElement | null
    ;(opt.danger ? cancelBtn : okBtn).current?.focus()   // untuk hapus, fokus awal di "Batal" supaya aman
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Tab') {   // fokus tetap di dalam dialog
        const a = cancelBtn.current, b = okBtn.current
        if (!a || !b) return
        e.preventDefault()
        ;(document.activeElement === a ? b : a).focus()
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.() }
  }, [opt, close])

  return (
    <Ctx.Provider value={ask}>
      {children}
      {opt && (
        <div className={`dlg-scrim${closing ? ' out' : ''}`} onClick={() => close(false)}>
          <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby={opt.message ? 'dlg-m' : undefined}
            onClick={e => e.stopPropagation()}>
            <div className="dlg-body">
              <p id="dlg-t" className="dlg-title">{opt.title}</p>
              {opt.message && <p id="dlg-m" className="dlg-msg">{opt.message}</p>}
            </div>
            <div className="dlg-actions">
              <button ref={cancelBtn} type="button" onClick={() => close(false)}>{opt.cancelLabel ?? 'Batal'}</button>
              <button ref={okBtn} type="button" className={opt.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {opt.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useConfirm = () => useContext(Ctx)
