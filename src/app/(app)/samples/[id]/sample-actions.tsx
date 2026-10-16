'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Transition {
  label: string
  next: string
  variant?: string
}

export function SampleActions({ sampleId, transitions }: { sampleId: string; transitions: Transition[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleTransition(next: string) {
    setLoading(next)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('samples')
      .update({ status: next })
      .eq('id', sampleId)
    if (err) { setError(err.message); setLoading(null); return }
    router.refresh()
    setLoading(null)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {transitions.map(t => (
          <Button
            key={t.next}
            variant={t.variant === 'destructive' ? 'outline' : 'default'}
            className={`w-full text-sm ${t.variant === 'destructive' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}`}
            loading={loading === t.next}
            disabled={loading !== null}
            onClick={() => handleTransition(t.next)}
          >
            {t.label}
          </Button>
        ))}
        {error && <p className="text-xs text-[var(--destructive)] mt-1">{error}</p>}
      </CardContent>
    </Card>
  )
}
