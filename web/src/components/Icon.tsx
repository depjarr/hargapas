/** Ikon garis sederhana (gaya SF Symbols). */
const P: Record<string, string> = {
  home: 'M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z',
  calc: 'M7 2.8h10A2.2 2.2 0 0 1 19.2 5v14a2.2 2.2 0 0 1-2.2 2.2H7A2.2 2.2 0 0 1 4.8 19V5A2.2 2.2 0 0 1 7 2.8zM8 6.5h8v3H8zM8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01',
  box: 'M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
  bulb: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.3 1.5 1.3 2.4h5c0-.9.6-1.8 1.3-2.4A6 6 0 0 0 12 3z',
  chat: 'M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
  chart: 'M3.5 20.5h17M6.5 17v-6M11 17V6M15.5 17v-8M20 17v-3',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  plus: 'M12 5v14M5 12h14',
  more: 'M4.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M10.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M16.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-5-5',
  right: 'm9.5 6 6 6-6 6',
  left: 'm14.5 6-6 6 6 6',
  logout: 'M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5M10 16.5 14.5 12 10 7.5M14.5 12H3.5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  download: 'M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14',
  send: 'M5 12h13M13 6l6 6-6 6',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  spark: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0zM8 8h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  trend: 'M3.5 17 9 11.5l4 4 7.5-7.5M15 8h5.5v5.5',
  wallet: 'M4 7.5h15a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5h11M16 13.5h.01',
  key: 'M14.5 14a5 5 0 1 0-4.6-3L3.5 17.4V20.5h3.1v-2h2v-2h2l1.4-1.4A5 5 0 0 0 14.5 14zM16.5 7.5h.01',
  copy: 'M9 9h10.5v11.5H9zM15 9V4.5H4.5V15H9',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  layers:'M12 3.5 3.5 8 12 12.5 20.5 8zM3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16',
}
export type IconName = keyof typeof P

export default function Icon({ n, className = 'i' }: { n: IconName | string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={P[n] ?? ''} /></svg>
}

export const Spinner = ({ text = 'Memuat…' }: { text?: string }) => (
  <div className="loading" role="status"><div className="spin" />{text}</div>
)
