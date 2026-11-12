import { PASSWORD_RULES } from '../lib/password'
import Icon from './Icon'

/** Daftar syarat password yang langsung tercentang saat mengetik. */
export default function PasswordChecklist({ value }: { value: string }) {
  const done = PASSWORD_RULES.filter(r => r.test(value)).length
  const level = done <= 2 ? 'weak' : done < PASSWORD_RULES.length ? 'mid' : 'ok'
  return (
    <div className="pwcheck" aria-live="polite">
      <div className={`pwbar ${value ? level : ''}`}><i style={{ width: `${(done / PASSWORD_RULES.length) * 100}%` }} /></div>
      <ul>
        {PASSWORD_RULES.map(r => {
          const ok = r.test(value)
          return (
            <li key={r.id} className={ok ? 'ok' : ''}>
              <span className="tick" aria-hidden>{ok ? <Icon n="check" /> : null}</span>
              {r.label}<span className="sr-only">{ok ? ' — terpenuhi' : ' — belum'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
