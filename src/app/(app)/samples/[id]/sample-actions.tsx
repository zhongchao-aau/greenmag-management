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

const DANGER_STATUSES = ['scrapped']
const WARNING_STATUSES = ['retired', 'failure_analysis']

interface SampleActionsProps {
  sampleId: string
  currentStatus: string
}

export default function SampleActions({ sampleId, currentStatus }: SampleActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const available = STATUSES.filter(s => s.value !== currentStatus)

  async function handleTransition(nextStatus: string) {
    setLoading(nextStatus)
    const { error } = await supabase
      .from('samples')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', sampleId)
    setLoading(null)
    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((s) => {
        const isDanger = DANGER_STATUSES.includes(s.value)
        const isWarning = WARNING_STATUSES.includes(s.value)
        const baseClass = 'px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50'
        const colorClass = isDanger
          ? 'bg-red-600 text-white hover:bg-red-700'
          : isWarning
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
        return (
          <button
            key={s.value}
            onClick={() => handleTransition(s.value)}
            disabled={loading !== null}
            className={`${baseClass} ${colorClass}`}
          >
            {loading === s.value ? 'Updating…' : `→ ${s.label}`}
          </button>
        )
      })}
    </div>
  )
}
