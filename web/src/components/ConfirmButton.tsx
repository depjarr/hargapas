import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Ketuk dua kali untuk konfirmasi (sama seperti tombol hapus di HTML). */
export default function ConfirmButton({ onConfirm, className = 'btn danger', children, disabled }:
  { onConfirm: () => void; className?: string; children: ReactNode; disabled?: boolean }) {
  const [armed, setArmed] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => {
      if (armed) { window.clearTimeout(t.current); setArmed(false); onConfirm(); return }
      setArmed(true)
      t.current = window.setTimeout(() => setArmed(false), 3000)
    }}>
      {armed ? 'Yakin? Ketuk lagi' : children}
    </button>
  )
}
