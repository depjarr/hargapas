export const rp = (n: number) => (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID')
export const pc = (n: number) => (n || 0).toFixed(1).replace('.', ',') + '%'
export const today = () => new Date().toISOString().slice(0, 10)
export const dt = (s: string) => new Date(s).toLocaleString('id-ID')
export const dd = (s: string) => new Date(s).toLocaleDateString('id-ID')
