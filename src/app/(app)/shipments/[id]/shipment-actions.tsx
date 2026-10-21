'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

// Full status flow:
// created → china_dispatched → cn_transit → customs → eu_transit → delivered → received → complete
// Exception is a FLAG (has_exception), not a separate status — can be set at any stage.
const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  created: [{ label: 'Mark China Dispatched', next: 'china_dispatched' }],
  china_dispatched: [{ label: 'Mark CN Transit', next: 'cn_transit' }],
  cn_transit: [
    { label: 'At Customs', next: 'customs' },
    { label: 'In EU Transit', next: 'eu_transit' },
  ],
  customs: [{ label: 'Cleared — In EU Transit', next: 'eu_transit' }],
  eu_transit: [{ label: 'Mark Delivered', next: 'delivered' }],
  delivered: [{ label: 'Mark Received', next: 'received' }],
  received: [{ label: 'Mark Complete', next: 'complete' }],
  // Legacy status values — still allow forward progress
  dispatched: [{ label: 'Mark CN Transit', next: 'cn_transit' }],
  in_transit: [
    { label: 'At Customs', next: 'customs' },
    { label: 'In EU Transit', next: 'eu_transit' },
  ],
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  china_dispatched: 'Dispatched from China',
  cn_transit: 'In Transit (China)',
  customs: 'At Customs',
  eu_transit: 'In EU Transit',
  delivered: 'Delivered',
  received: 'Received',
  complete: 'Complete',
}

interface ShipmentActionsProps {
  shipmentId: string
  shipmentCode: string
  status: string
  isAdmin: boolean
  hasException: boolean
  exceptionNotes: string | null
}

export function ShipmentActions({ shipmentId, shipmentCode, status, isAdmin, hasException, exceptionNotes }: ShipmentActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Exception flag state
  const [showExceptionForm, setShowExceptionForm] = useState(false)
  const [exceptionInput, setExceptionInput] = useState(exceptionNotes ?? '')

  // Manual tracking event form state
  const [showEventForm, setShowEventForm] = useState(false)
  const [event, setEvent] = useState({
    description: '',
    location: '',
    leg: 'eu' as 'china' | 'eu' | 'single',
    event_time: new Date().toISOString().slice(0, 16),
  })

  const transitions = TRANSITIONS[status] ?? []
  const isTerminal = status === 'complete' || status === 'returned'
  const canRefresh = status === 'eu_transit' || status === 'delivered'

  async function refreshTracking() {
    setLoading('refresh')
    setRefreshResult(null)
    try {
      const res = await fetch('/api/tracking/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refresh failed')
      if (data.updated > 0) {
        setRefreshResult('Tracking updated ✓')
      } else if (data.errors?.length > 0) {
        setRefreshResult(`Carrier error: ${data.errors[0].error}`)
      } else {
        setRefreshResult('No new events')
      }
      router.refresh()
    } catch (err) {
      setRefreshResult(err instanceof Error ? err.message : 'Error')
    }
    setLoading(null)
  }

  async function performTransition(next: string) {
    setLoading(next)
    setError('')
    const supabase = createClient()
    const update: Record<string, unknown> = { status: next }
    if (next === 'delivered') update.actual_delivery = new Date().toISOString()
    if (next === 'china_dispatched') update.china_dispatched_at = new Date().toISOString()
    if (next === 'eu_transit') update.eu_dispatched_at = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from('shipments') as any).update(update).eq('id', shipmentId)
    if (err) { setError(err.message); setLoading(null); return }

    // Log to linked orders' activity history
    const { data: { user } } = await supabase.auth.getUser()
    const { data: linkedOrders } = await supabase
      .from('shipment_orders')
      .select('order_id')
      .eq('shipment_id', shipmentId)
    if (linkedOrders && linkedOrders.length > 0) {
      const statusLabel = SHIPMENT_STATUS_LABELS[next] ?? next
      const activityRows = linkedOrders.map((row: { order_id: string }) => ({
        entity_type: 'purchase_order',
        entity_id: row.order_id,
        action: 'shipment_status_changed',
        description: `Shipment ${shipmentCode}: ${statusLabel}`,
        performed_by: user?.id ?? null,
      }))
      await supabase.from('activity_log').insert(activityRows)
    }

    router.refresh()
    setLoading(null)
  }

  async function saveException(e: React.FormEvent) {
    e.preventDefault()
    setLoading('exception')
    setError('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from('shipments') as any).update({
      has_exception: true,
      exception_notes: exceptionInput || null,
    }).eq('id', shipmentId)
    if (err) { setError(err.message) } else { setShowExceptionForm(false); router.refresh() }
    setLoading(null)
  }

  async function clearException() {
    setLoading('clear-exception')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('shipments') as any).update({ has_exception: false, exception_notes: null }).eq('id', shipmentId)
    router.refresh()
    setLoading(null)
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    setLoading('event')
    setError('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from('shipment_events') as any).insert({
      shipment_id: shipmentId,
      description: event.description,
      location: event.location || null,
      tracking_leg: event.leg,
      event_date: new Date(event.event_time).toISOString(),
    })
    if (err) setError(err.message)
    else {
      router.refresh()
      setShowEventForm(false)
      setEvent({ description: '', location: '', leg: 'eu', event_time: new Date().toISOString().slice(0, 16) })
    }
    setLoading(null)
  }

  if (!isAdmin) return null

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">

        {/* Status transitions */}
        {transitions.map(t => (
          <Button key={t.next} size="sm" variant="outline" className="w-full justify-start"
            loading={loading === t.next} onClick={() => performTransition(t.next)}>
            {t.label}
          </Button>
        ))}

        {isTerminal && (
          <p className="text-xs text-[var(--muted-foreground)] px-1">This shipment is complete.</p>
        )}

        {/* Exception flag */}
        <div className="border-t border-[var(--border)] my-1" />
        {hasException ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Exception flagged
              </div>
              <button onClick={clearException} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {exceptionNotes && <p className="text-xs text-amber-700 dark:text-amber-400">{exceptionNotes}</p>}
            <button className="text-xs text-amber-600 underline" onClick={() => setShowExceptionForm(true)}>Edit notes</button>
          </div>
        ) : (
          !showExceptionForm && (
            <Button size="sm" variant="ghost" className="w-full justify-start text-amber-600 hover:text-amber-700"
              onClick={() => setShowExceptionForm(true)}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Flag Exception
            </Button>
          )
        )}

        {showExceptionForm && (
          <form onSubmit={saveException} className="border border-amber-300 rounded-md p-3 space-y-2 bg-amber-50 dark:bg-amber-950/30">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Exception Notes</p>
            <textarea
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              rows={2}
              placeholder="Describe the exception (optional)"
              value={exceptionInput}
              onChange={e => setExceptionInput(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={loading === 'exception'} className="flex-1">Save</Button>
              <Button size="sm" type="button" variant="outline" onClick={() => setShowExceptionForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Manual tracking event */}
        <div className="border-t border-[var(--border)] my-1" />
        {!showEventForm ? (
          <Button size="sm" variant="ghost" className="w-full justify-start text-[var(--muted-foreground)]"
            onClick={() => setShowEventForm(true)}>
            + Add Tracking Event
          </Button>
        ) : (
          <form onSubmit={addEvent} className="border border-[var(--border)] rounded-md p-3 space-y-2 bg-[var(--secondary)]">
            <p className="text-xs font-medium">Add Tracking Event</p>
            <input
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="e.g. Departed Shenzhen hub"
              value={event.description}
              onChange={e => setEvent(ev => ({ ...ev, description: e.target.value }))}
              required
            />
            <input
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="Location (optional)"
              value={event.location}
              onChange={e => setEvent(ev => ({ ...ev, location: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                value={event.leg}
                onChange={e => setEvent(ev => ({ ...ev, leg: e.target.value as 'china' | 'eu' | 'single' }))}
              >
                <option value="china">🇨🇳 China leg</option>
                <option value="eu">🇪🇺 EU leg</option>
                <option value="single">Single leg</option>
              </select>
              <input
                type="datetime-local"
                className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                value={event.event_time}
                onChange={e => setEvent(ev => ({ ...ev, event_time: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={loading === 'event'} className="flex-1">Add</Button>
              <Button size="sm" type="button" variant="outline" onClick={() => setShowEventForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Auto-refresh tracking (EU transit only) */}
        {canRefresh && (
          <>
            <div className="border-t border-[var(--border)] my-1" />
            <Button size="sm" variant="ghost" className="w-full justify-start text-[var(--muted-foreground)]"
              loading={loading === 'refresh'} onClick={refreshTracking}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh EU Tracking
            </Button>
            {refreshResult && (
              <p className="text-xs text-[var(--muted-foreground)] px-1">{refreshResult}</p>
            )}
          </>
        )}

        {error && <p className="text-xs text-[var(--destructive)] mt-1">{error}</p>}
      </CardContent>
    </Card>
  )
}
