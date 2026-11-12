import { FunctionsHttpError } from '@supabase/supabase-js'

/** Ambil pesan error dari Edge Function (kalau ada). */
export async function fnErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const j = await error.context.json()
      if (j?.error) return String(j.error)
    } catch { /* abaikan */ }
  }
  return fallback
}
