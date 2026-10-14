'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// ── Location constants ──────────────────────────────────────────────────────
export const LOCATIONS: { value: string; label: string }[] = [
  { value: 'china',      label: 'China' },
  { value: 'dk_aalborg', label: 'Aalborg, Denmark' },
  { value: 'dk_hammel',  label: 'Hammel, Denmark' },
  { value: 'lv',         label: 'Latvia' },
]
export const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  LOCATIONS.map(l => [l.value, l.label])
)

export default function NewShipmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preOrderId = searchParams.get('order')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // shipment type: 'component_order' | 'sample_transfer'
  const [shipmentType, setShipmentType] = useState<'component_order' | 'sample_transfer'>('component_order')

  // location
  const [origin, setOrigin] = useState('china')
  const [destination, setDestination] = useState('dk_aalborg')

  // linked orders (for component_order type)
  const [orders, setOrders] = useState<{ id: string; code: string; supplier: { name: string } | null }[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(preOrderId ? [preOrderId] : [])

  // linked samples (for sample_transfer type)
  const [samples, setSamples] = useState<{ id: string; code: string; status: string; product_variants: { name: string; products: { name: string } | null } | null }[]>([])
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([])

  const [form, setForm] = useState({
    description: '',
    expected_delivery: '',
    china_carrier: '', china_tracking_number: '', china_tracking_url: '',
    eu_carrier: '',    eu_tracking_number: '',    eu_tracking_url: '',
    notes: '',
  })

  const isFromChina = origin === 'china'

  useEffect(() => {
    const supabase = createClient()
    // Load orders
    supabase.from('purchase_orders')
      .select('id, code, supplier:suppliers(name)')
      .not('status', 'in', '("closed","received")')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data ?? []))
    // Load samples
    supabase.from('samples')
      .select('id, code, status, product_variants(name, products(name))')
      .not('status', 'in', '("scrapped")')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSamples((data ?? []) as typeof samples))
  }, [])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }
  function toggleOrder(id: string) { setSelectedOrderIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }
  function toggleSample(id: string) { setSelectedSampleIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipment, error: err } = await (supabase.from('shipments') as any)
      .insert({
        shipment_type: shipmentType,
        origin,
        destination,
        order_id: (shipmentType === 'component_order' && selectedOrderIds.length > 0) ? selectedOrderIds[0] : null,
        description: form.description || null,
        expected_delivery: form.expected_delivery || null,
        china_carrier: form.china_carrier || null,
        china_tracking_number: form.china_tracking_number || null,
        china_tracking_url: form.china_tracking_url || null,
        eu_carrier: isFromChina ? (form.eu_carrier || null) : null,
        eu_tracking_number: isFromChina ? (form.eu_tracking_number || null) : null,
        eu_tracking_url: isFromChina ? (form.eu_tracking_url || null) : null,
        notes: form.notes || null,
        status: 'created',
      })
      .select('id')
      .single()

    if (err || !shipment) { setError(err?.message ?? 'Failed to create shipment'); setLoading(false); return }

    // Insert junction rows
    if (shipmentType === 'component_order' && selectedOrderIds.length > 0) {
      await supabase.from('shipment_orders').insert(
        selectedOrderIds.map(order_id => ({ shipment_id: shipment.id, order_id }))
      )
    }
    if (shipmentType === 'sample_transfer' && selectedSampleIds.length > 0) {
      await supabase.from('shipment_samples').insert(
        selectedSampleIds.map(sample_id => ({ shipment_id: shipment.id, sample_id }))
      )
    }

    router.push(`/shipments/${shipment.id}`)
    router.refresh()
  }

  const selectClass = 'w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shipments
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Shipment</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Track a shipment of components or samples between locations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Type toggle */}
        <Card>
          <CardHeader><CardTitle>Shipment Type</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {(['component_order', 'sample_transfer'] as const).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setShipmentType(t)}
                  className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                    shipmentType === t
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                      : 'border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)]'
                  }`}
                >
                  {t === 'component_order' ? '📦 Component Order' : '🧪 Sample Transfer'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {shipmentType === 'component_order'
                ? 'Shipment of purchased components from a supplier.'
                : 'Transfer of built samples between cooperator sites.'}
            </p>
          </CardContent>
        </Card>

        {/* Route */}
        <Card>
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Origin</label>
                <select className={selectClass} value={origin} onChange={e => setOrigin(e.target.value)}>
                  {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Destination</label>
                <select className={selectClass} value={destination} onChange={e => setDestination(e.target.value)}>
                  {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
            {isFromChina && (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded px-3 py-1.5">
                🇨🇳→🇪🇺 Two-leg shipment — you can enter both a China and an EU carrier below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Linked content */}
        <Card>
          <CardHeader>
            <CardTitle>{shipmentType === 'component_order' ? 'Linked Purchase Orders' : 'Linked Samples'}</CardTitle>
          </CardHeader>
          <CardContent>
            {shipmentType === 'component_order' ? (
              <>
                <p className="text-xs text-[var(--muted-foreground)] mb-2">Select one or more purchase orders included in this shipment.</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[var(--border)] rounded-md p-2">
                  {orders.length === 0 && <p className="text-sm text-[var(--muted-foreground)] px-1">No open orders</p>}
                  {orders.map(o => (
                    <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--accent)] cursor-pointer text-sm">
                      <input type="checkbox" className="rounded" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                      <span className="font-mono">{o.code}</span>
                      {o.supplier && <span className="text-[var(--muted-foreground)]">· {(o.supplier as { name: string }).name}</span>}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-[var(--muted-foreground)] mb-2">Select the samples being shipped.</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[var(--border)] rounded-md p-2">
                  {samples.length === 0 && <p className="text-sm text-[var(--muted-foreground)] px-1">No samples found</p>}
                  {samples.map(s => {
                    const v = s.product_variants as any
                    const label = v ? `${v.products?.name ?? ''} · ${v.name}` : s.code
                    return (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--accent)] cursor-pointer text-sm">
                        <input type="checkbox" className="rounded" checked={selectedSampleIds.includes(s.id)} onChange={() => toggleSample(s.id)} />
                        <span className="font-mono text-xs">{s.code}</span>
                        <span>{label}</span>
                        <span className="ml-auto text-xs text-[var(--muted-foreground)]">{s.status}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Shipment details */}
        <Card>
          <CardHeader><CardTitle>Shipment Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Magnet batch Jan 2025, sample for testing..." />
            <Input label="Expected Delivery Date" type="date" value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)} />
          </CardContent>
        </Card>

        {/* China leg (always shown, labelled by origin if not China) */}
        <Card>
          <CardHeader>
            <CardTitle>{isFromChina ? 'China Leg 🇨🇳' : 'Carrier / Tracking'}</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              {isFromChina ? 'Domestic Chinese courier / freight from supplier' : 'Carrier details for this shipment'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Carrier" value={form.china_carrier} onChange={e => set('china_carrier', e.target.value)} placeholder={isFromChina ? 'e.g. SF Express, EMS' : 'e.g. DHL, PostNord'} />
              <Input label="Tracking Number" value={form.china_tracking_number} onChange={e => set('china_tracking_number', e.target.value)} />
            </div>
            <Input label="Tracking URL" type="url" value={form.china_tracking_url} onChange={e => set('china_tracking_url', e.target.value)} placeholder="https://..." hint="Paste the carrier tracking link" />
          </CardContent>
        </Card>

        {/* EU leg — only when origin is China */}
        {isFromChina && (
          <Card>
            <CardHeader>
              <CardTitle>EU Leg 🇪🇺</CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]">International / EU carrier from China to Denmark</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Carrier" value={form.eu_carrier} onChange={e => set('eu_carrier', e.target.value)} placeholder="e.g. DHL, FedEx, PostNord" />
                <Input label="Tracking Number" value={form.eu_tracking_number} onChange={e => set('eu_tracking_number', e.target.value)} />
              </div>
              <Input label="Tracking URL" type="url" value={form.eu_tracking_url} onChange={e => set('eu_tracking_url', e.target.value)} placeholder="https://..." hint="Can be filled in later when EU carrier picks up the package" />
            </CardContent>
          </Card>
        )}

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
