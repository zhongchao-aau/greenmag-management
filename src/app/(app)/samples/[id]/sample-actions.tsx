'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  manufactured: [
    { label: 'Start Testing', next: 'in_test' },
    { label: 'Scrap', next: 'scrapped' },
  ],
  in_test: [
    { label: 'Mark Passed', next: 'passed' },
    { label: 'Mark Failed', next: 'failed' },
  ],
  passed: [
    { label: 'Deploy', next: 'deployed' },
    { label: 'Scrap', next: 'scrapped' },
  ],
  failed: [
    { label: 'Scrap', next: 'scrapped' },
  ],
  deployed: [],
  scrapped: [],
}

interface SampleActionsProps {
  id: string
  currentStatus: string
}

export function SampleActions({ id, currentStatus }: SampleActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const transitions = TRANSITIONS[currentStatus] ?? []
  if (transitions.length === 0) return <p className="text-sm text-[var(--muted-foreground)]">No further transitions available.</p>

  async function transition(next: string) {
    setLoading(next)
    setError('')
    const supabase = createClient()
    const update: Record<string, unknown> = { status: next }
    if (next === 'deployed') update.deployed_at = new Date().toISOString()
    const { error: err } = await supabase.from('samples').update(update).eq('id', id)
    if (err) { setError(err.message); setLoading(null); return }
    router.refresh()
    setLoading(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {transitions.map(t => (
          <Button
            key={t.next}
            variant={t.next === 'scrapped' || t.next === 'failed' ? 'outline' : 'default'}
            loading={loading === t.next}
            onClick={() => transition(t.next)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  )
}
