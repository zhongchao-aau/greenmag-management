'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

    // Consume BOM components from inventory when marking as manufactured
    if (next === 'manufactured') {
      const { data: sample } = await supabase
        .from('samples')
        .select('variant_id, variant_serial')
        .eq('id', id)
        .single()

      if (sample?.variant_id) {
        const { data: mfgConfig } = await supabase
          .from('manufacturing_configurations')
          .select('id')
          .eq('variant_id', sample.variant_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (mfgConfig) {
          const { data: bomLines } = await supabase
            .from('bom_lines')
            .select('component_id, qty_per_unit')
            .eq('mfg_config_id', mfgConfig.id)

          if (bomLines && bomLines.length > 0) {
            await supabase.from('inventory_transactions').insert(
              bomLines.map((line: { component_id: string; qty_per_unit: number }) => ({
                component_id: line.component_id,
                transaction_type: 'usage',
                quantity: line.qty_per_unit,
                notes: `Manufacturing sample ${id} (serial ${sample.variant_serial})`,
              }))
            )
          }
        }
      }
    }

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

  // Show "Create Order" link for admin on approved procure requests
  const showCreateOrder = isAdmin && status === 'approved' && requestType === 'procure'

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
      {showCreateOrder && (
        <div className="pt-1 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">Request approved — ready to place order:</p>
          <Link
            href={`/orders/new?request=${requestId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[var(--primary)] rounded-md px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            Create Purchase Order →
          </Link>
        </div>
      )}
    </div>
  )
}
