'use client'
import { PREFERRED_LOCS, CHINA_PROVINCES, WORLD_LOCS } from '@/lib/locations'

export function LocationSelect({ id, value, onChange, placeholder = 'Not specified' }: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
    >
      <option value="">{'— ' + placeholder + ' —'}</option>
      <optgroup label="Preferred">
        {PREFERRED_LOCS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
      <optgroup label="China — by Province / Region">
        {CHINA_PROVINCES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
      <optgroup label="Europe &amp; World">
        {WORLD_LOCS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
    </select>
  )
}
