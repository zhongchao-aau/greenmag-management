'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'approved_to_build', label: 'Approved to Build' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'in_test', label: 'In Test' },
  { value: 'failure_analysis', label: 'Failure Analysis' },
  { value: 'passed', label: 'Passed' },
  { value: 'retired', label: 'Retired' },
  { value: 'scrapped', label: 'Scrapped' },
]

function toLocalDatetimeValue(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

interface SampleActionsProps {
  sampleId: string
  currentStatus: string
}

export default function SampleActions({ sampleId, currentStatus }: SampleActionsProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [notes, setNotes] = useState('')
  const [changedAt, setChangedAt] = useState(() => toLocalDatetimeValue(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedStatus === currentStatus) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const changedAtUTC = new Date(changedAt).toISOString()

    const { error: updateError } = await supabase
      .from('samples')
      .update({ status: selectedStatus })
      .eq('id', sampleId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.from('sample_status_history').insert({
      sample_id: sampleId,
      status: selectedStatus,
      changed_by: user?.email ?? null,
      notes: notes.trim() || null,
      changed_at: changedAtUTC,
    })

    setNotes('')
    setChangedAt(toLocalDatetimeValue(new Date()))
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">New Status</label>
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          {STATUSES.map(s => (
            <option key={s.value} value={s.value} disabled={s.value === currentStatus}>
              {s.label}{s.value === currentStatus ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Date &amp; Time</label>
        <input
          type="datetime-local"
          value={changedAt}
          onChange={e => setChangedAt(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Notes <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Add notes about this status change..."
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
        />
      </div>

      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

      <button
        type="submit"
        disabled={loading || selectedStatus === currentStatus}
        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? 'Updating…' : 'Update Status'}
      </button>
    </form>
  )
}
