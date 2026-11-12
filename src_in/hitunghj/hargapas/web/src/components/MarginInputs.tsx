import { useEffect, useState } from 'react'
import { useData } from '../lib/data'
import { NM } from '../lib/calc'

/** Target untung (% dari HPP) untuk 3 strategi. Berubah langsung dan dipakai semua halaman. */
export default function MarginInputs() {
  const { margins, setMargin } = useData()
  const [txt, setTxt] = useState<string[]>(margins.map(String))
  useEffect(() => {
    setTxt(t => margins.map((m, i) => ((+t[i] || 0) === m ? t[i] : String(m))))
  }, [margins])
  return (
    <div className="form">
      {NM.map((n, i) => (
        <label className="fld" key={n}>
          <span>{n}</span>
          <input type="number" inputMode="decimal" step="0.5" min="0" value={txt[i] ?? ''} aria-label={`Target untung ${n} (%)`}
            onChange={e => {
              setTxt(t => t.map((x, j) => (j === i ? e.target.value : x)))
              setMargin(i, +e.target.value || 0)
            }} />
          <span className="mu">%</span>
        </label>
      ))}
    </div>
  )
}
