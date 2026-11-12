/**
 * Aturan password HargaPas. Sama persis dengan pengecekan di server (Edge Function `recovery`).
 * Juga atur hal yang sama di Supabase: Authentication > Providers > Email > Password requirements.
 */
export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len', label: 'Minimal 8 karakter', test: p => p.length >= 8 },
  { id: 'upper', label: 'Ada huruf besar (A–Z)', test: p => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Ada huruf kecil (a–z)', test: p => /[a-z]/.test(p) },
  { id: 'digit', label: 'Ada angka (0–9)', test: p => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Ada simbol (mis. ! @ # $ % . _ -)', test: p => /[^A-Za-z0-9\s]/.test(p) },
]

/** Pesan kesalahan pertama, atau null kalau password sudah memenuhi semua aturan. */
export function passwordProblem(p: string, avoid: string[] = []): string | null {
  if (p.length > 72) return 'Password maksimal 72 karakter.'
  if (/^\s|\s$/.test(p)) return 'Password tidak boleh diawali atau diakhiri spasi.'
  const miss = PASSWORD_RULES.filter(r => !r.test(p))
  if (miss.length) return 'Password belum memenuhi syarat: ' + miss.map(r => r.label.toLowerCase()).join(', ') + '.'
  const lower = p.toLowerCase()
  for (const a of avoid) {
    const part = a.toLowerCase().split('@')[0].trim()
    if (part.length >= 4 && lower.includes(part)) return 'Password jangan memuat nama atau email kamu.'
  }
  return null
}
