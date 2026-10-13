'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Props {
  requestId: string
  status: string
  canEdit: boolean
  canSubmit: boolean
  canWithdraw: boolean
  canAdminReview: boolean
  isAdmin: boolean
  requestType?: string
  variantId?: string
  quantityToBuild?: number
}

export function SampleActions({ id, currentStatus }: { id: string; currentStatus: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
    approved_to_build: [{ label: 'Mark Manufactured', next: 'manufactured' }],
    manufactured: [{ label: 'Start Testing', next: 'in_test' }],
    in_test: [
      { label: 'Mark Passed', next: 'passed' },
      { label: 'Mark Failed', next: 'failed' },
    ],
    passed: [{ label: 'Deploy', next: 'deployed' }],
    failed: [{ label: 'Scrap', next: 'scrapped' }],
  }

  const transitions = TRANSITIONS[currentStatus] ?? []
  if (transitions.length === 0) return null

  async function transition(next: string) {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('samples').update({ status: next }).eq('id', id)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {transitions.map(t => (
        <Button
          key={t.next}
          size="sm"
          variant={t.next === 'failed' || t.next === 'scrapped' ? 'outline' : 'default'}
          disabled={loading}
          onClick={() => transition(t.next)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  )
}

export function RequestActions({
  requestId,
  status,
  canEdit,
  canSubmit,
  canWithdraw,
  canAdminReview,
  isAdmin,
  requestType,
  variantId,
  quantityToBuild,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function performAction(action: string) {
    setLoading(true)
    setError('')
    const supabase = createClient()

    try {
      if (action === 'submit') {
        const { error: err } = await supabase
          .from('purchase_requests').update({ status: 'submitted' }).eq('id', requestId)
        if (err) throw err
      } else if (action === 'withdraw') {
        const { error: err } = await supabase
          .from('purchase_requests').update({ status: 'draft' }).eq('id', requestId)
        if (err) throw err
      } else if (action === 'approve') {
        const { error: err } = await supabase
          .from('purchase_requests')
          .update({ status: 'approved', reviewed_at: new Date().toISOString() })
          .eq('id', requestId)
        if (err) throw err

        if (requestType === 'build' && variantId && quantityToBuild && quantityToBuild > 0) {
          const { count } = await supabase
            .from('samples').select('*', { count: 'exact', head: true }).eq('variant_id', variantId)
          const startSerial = (count ?? 0) + 1
          const samplesToInsert = []
          for (let i = 0; i < quantityToBuild; i++) {
            samplesToInsert.push({
              variant_id: variantId,
              variant_serial: startSerial + i,
              status: 'approved_to_build',
            })
          }
          const { error: sampleErr } = await supabase.from('samples').insert(samplesToInsert)
          if (sampleErr) throw sampleErr
        }
      } else if (action === 'reject') {
        const { error: err } = await supabase
          .from('purchase_requests')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .eq('id', requestId)
        if (err) throw err
      }

      router.refresh()
    } catch (e: any) {
      setError(e.message ?? 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        {canSubmit && (
          <Button size="sm" disabled={loading} onClick={() => performAction('submit')}>
            Submit for Review
          </Button>
        )}
        {canWithdraw && (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => performAction('withdraw')}>
            Withdraw
          </Button>
        )}
        {canAdminReview && (
          <>
            <Button size="sm" disabled={loading} onClick={() => performAction('approve')}>
              {requestType === 'build'
                ? `Approve & Create ${quantityToBuild ?? 1} Sample${(quantityToBuild ?? 1) > 1 ? 's' : ''}`
                : 'Approve'}
            </Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => performAction('reject')}>
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
