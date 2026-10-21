'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Full order lifecycle:
// draft → sent → confirmed → (partially_shipped|shipped) → (partially_received) → received → closed
const TRANSITIONS: Record<string, { label: string; next: string; style?: string }[]> = {
  draft: [
    { label: 'Issue Purchase Order', next: 'sent', style: 'primary' },
  ],
  sent: [
    { label: 'Supplier Confirmed', next: 'confirmed', style: 'primary' },
    { label: 'Back to Draft', next: 'draft' },
  ],
  confirmed: [
    { label: 'Mark as Shipped', next: 'shipped', style: 'primary' },
    { label: 'Partially Shipped', next: 'partially_shipped' },
  ],
  partially_shipped: [
    { label: 'All Goods Shipped', next: 'shipped', style: 'primary' },
    { label: 'Mark Partially Received', next: 'partially_received' },
  ],
  shipped: [
    { label: 'Mark as Received', next: 'received', style: 'primary' },
    { label: 'Partially Received', next: 'partially_received' },
  ],
  partially_received: [
    { label: 'All Goods Received', next: 'received', style: 'primary' },
  ],
  // Backward compat for pre-rename statuses (existing DB records)
  approved: [
    { label: 'Issue Purchase Order', next: 'sent', style: 'primary' },
  ],
  ordered: [
    { label: 'Supplier Confirmed', next: 'confirmed', style: 'primary' },
    { label: 'Back to Draft', next: 'draft' },
  ],
    received: [
    { label: 'Close Order', next: 'closed', style: 'primary' },
  ],
}

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const transitions = TRANSITIONS[status] ?? []
  if (transitions.length === 0) return null

  async function performTransition(next: string) {
    setLoading(next)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('purchase_orders')
      .update({ status: next })
      .eq('id', orderId)
    if (err) setError(err.message)
    else router.refresh()
    setLoading(null)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {transitions.map(t => (
          <Button
            key={t.next}
            size="sm"
            variant={t.style === 'primary' ? 'primary' : 'outline'}
            className="w-full justify-start"
            loading={loading === t.next}
            onClick={() => performTransition(t.next)}
          >
            {t.label}
          </Button>
        ))}
        {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
      </CardContent>
    </Card>
  )
}
