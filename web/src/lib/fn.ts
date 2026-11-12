import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

/** Ambil pesan error dari Edge Function, dengan penjelasan yang bisa dipahami pengguna. */
export async function fnErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status as number | undefined
    try {
      const j = await error.context.json()
      if (j?.error) return String(j.error)
      if (j?.code === 'NOT_FOUND' || status === 404)
        return 'Fitur ini belum aktif di server (Edge Function belum di-deploy ke Supabase).'
      if (j?.message) return `${fallback} (${j.message})`
    } catch { /* bukan JSON */ }
    if (status === 401) return 'Sesi habis atau tidak diizinkan. Coba keluar lalu masuk lagi.'
    if (status && status >= 500) return `${fallback} Server sedang bermasalah (kode ${status}).`
    return status ? `${fallback} (kode ${status})` : fallback
  }
  if (error instanceof FunctionsFetchError) return `${fallback} Periksa koneksi internet, lalu coba lagi.`
  if (error instanceof FunctionsRelayError) return `${fallback} Server Supabase tidak merespons, coba lagi sebentar.`
  return fallback
}
