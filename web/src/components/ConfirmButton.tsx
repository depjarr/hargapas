import type { ReactNode } from 'react'
import { useConfirm, type ConfirmOptions } from '../lib/confirm'

/** Tombol yang meminta konfirmasi lewat dialog gaya iOS sebelum menjalankan aksi (mis. hapus). */
export default function ConfirmButton({ onConfirm, className = 'btn danger', children, disabled, confirm }:
  { onConfirm: () => void; className?: string; children: ReactNode; disabled?: boolean; confirm: ConfirmOptions }) {
  const ask = useConfirm()
  return (
    <button type="button" className={className} disabled={disabled}
      onClick={async () => { if (await ask({ danger: true, ...confirm })) onConfirm() }}>
      {children}
    </button>
  )
}
