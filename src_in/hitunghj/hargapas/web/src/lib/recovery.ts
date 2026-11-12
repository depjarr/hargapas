import { supabase } from './supabase'
import { fnErrorMessage } from './fn'

/** Panggil Edge Function `recovery` (kode pemulihan password). */
export async function recovery<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('recovery', { body })
  if (error) throw new Error(await fnErrorMessage(error, 'Fitur kode pemulihan belum aktif atau sedang bermasalah. Coba lagi sebentar.'))
  return data as T
}
