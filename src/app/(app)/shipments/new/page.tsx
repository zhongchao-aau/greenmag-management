'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewShipmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preOrderId = searchParams.get('order')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<{ id: string; code: string; supplier: { name: string } | null }[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(preOrderId ? [preOrderId] : [])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    description: '',
    expected_delivery: '',
    // China leg
    china_carrier: '',
    china_tracking_number: '',
    china_tracking_url: '',
    // EU leg
    eu_carrier: '',
    eu_tracking_number: '',
    eu_tracking_url: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, code, supplier:suppliers(name)')
        .not('status', 'in', '("closed","received")')
        .order('created_at', { ascending: false })
      setOrders(data ?? [])
    }
    load()
  }, [])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  function toggleOrder(id: string) {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipment, error: err } = await (supabase.from('shipments') as any)
      .insert({
        order_id: selectedOrderIds[0] || null,   // keep for backwards compat
        description: form.description || null,
        expected_delivery: form.expected_delivery || null,
        china_carrier: form.china_carrier || null,
        china_tracking_number: form.china_tracking_number || null,
        china_tracking_url: form.china_tracking_url || null,
        eu_carrier: form.eu_carrier || null,
        eu_tracking_number: form.eu_tracking_number || null,
        eu_tracking_url: form.eu_tracking_url || null,
        notes: form.notes || null,
        status: 'created',
      })
      .select('id')
      .single()

    if (err || !shipment) { setError(err?.message ?? 'Failed to create shipment'); setLoading(false); return }

    // Link all selected orders via junction table
    if (selectedOrderIds.length > 0) {
      await supabase.from('shipment_orders').insert(
        selectedOrderIds.map(order_id => ({ shipment_id: shipment.id, order_id }))
      )
    }

    router.push(`/shipments/${shipment.id}`)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shipments
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Shipment</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Track a dual-leg shipment from China supplier to Denmark.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Shipment Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Linked Purchase Orders</label>
              <p className="text-xs text-[var(--muted-foreground)] mb-2">Select one or more orders included in this shipment.</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[var(--border)] rounded-md p-2">
                {orders.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)] px-1">No open orders</p>
                )}
                {orders.map(o => (
                  <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--accent)] cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={() => toggleOrder(o.id)}
                    />
                    <span className="font-mono">{o.code}</span>
                    {o.supplier && <span className="text-[var(--muted-foreground)]">· {(o.supplier as { name: string }).name}</span>}
                  </label>
                ))}
              </div>
            </div>
            <Input
              label="Description"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="e.g. Magnet batch Jan 2025, PCB components..."
            />
            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.expected_delivery}
              onChange={e => set('expected_delivery', e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>China Leg 🇨🇳</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">Domestic Chinese courier / freight from supplier</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Carrier" value={form.china_carrier} onChange={e => set('china_carrier', e.target.value)} placeholder="e.g. SF Express, EMS, DHL China" />
              <Input label="Tracking Number" value={form.china_tracking_number} onChange={e => set('china_tracking_number', e.target.value)} placeholder="e.g. SF1234567890CN" />
            </div>
            <Input label="Tracking URL" type="url" value={form.china_tracking_url} onChange={e => set('china_tracking_url', e.target.value)} placeholder="https://..." hint="Paste the carrier tracking link" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>EU Leg 🇪🇺</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">International / EU carrier from China to Denmark</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Carrier" value={form.eu_carrier} onChange={e => set('eu_carrier', e.target.value)} placeholder="e.g. DHL, FedEx, PostNord" />
              <Input label="Tracking Number" value={form.eu_tracking_number} onChange={e => set('eu_tracking_number', e.target.value)} placeholder="e.g. 1234567890" />
            </div>
            <Input label="Tracking URL" type="url" value={form.eu_tracking_url} onChange={e => set('eu_tracking_url', e.target.value)} placeholder="https://..." hint="Can be filled in later when EU carrier picks up the package" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Customs declaration value, special handling, etc."
            />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" loading={loading}>Create Shipment</Button>
          <Link href="/shipments"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  )
}
