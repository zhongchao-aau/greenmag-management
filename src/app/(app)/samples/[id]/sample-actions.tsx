'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TRANSITIONS: Record<string, { label: string; next: string; variant?: string }[]> = {
  approved_to_build: [
    { label: 'Start Material Preparation', next: 'material_preparation' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  material_preparation: [
    { label: 'Start Manufacturing', next: 'manufacturing' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  manufacturing: [
    { label: 'Mark as Manufactured', next: 'manufactured' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  manufactured: [
    { label: 'Start Testing', next: 'in_test' },
    { label: 'Retire', next: 'retired', variant: 'warning' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  in_test: [
    { label: 'Start Post-Test Analysis', next: 'post_test_analysis' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  post_test_analysis: [
    { label: 'Mark as Passed', next: 'passed' },
    { label: 'Mark as Failed', next: 'failed', variant: 'danger' },
  ],
  passed: [
    { label: 'Deploy', next: 'deployed' },
    { label: 'Retire', next: 'retired', variant: 'warning' },
  ],
  failed: [
    { label: 'Retire', next: 'retired', variant: 'warning' },
    { label: 'Scrap', next: 'scrapped', variant: 'danger' },
  ],
  deployed: [
    { label: 'Retire', next: 'retired', variant: 'warning' },
  ],
  retired: [],
  scrapped: [],
}

interface SampleActionsProps {
  sampleId: string
  currentStatus: string
}

export default function SampleActions({ sampleId, currentStatus }: SampleActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const transitions = TRANSITIONS[currentStatus] ?? []

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No further transitions available.</p>
    )
  }

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
      {transitions.map((t) => {
        const isDanger = t.variant === 'danger'
        const isWarning = t.variant === 'warning'
        const baseClass = 'px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50'
        const colorClass = isDanger
          ? 'bg-red-600 text-white hover:bg-red-700'
          : isWarning
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
        return (
          <button
            key={t.next}
            onClick={() => handleTransition(t.next)}
            disabled={loading !== null}
            className={`${baseClass} ${colorClass}`}
          >
            {loading === t.next ? 'Updating…' : t.label}
          </button>
        )
      })}
    </div>
  )
}
