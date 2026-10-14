'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LocationSelect } from '@/components/ui/location-select'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import Link from 'next/link'

export default function ShipmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [shipmentType, setShipmentType] = useState<string>('component_order')
  const [isFromChina, setIsFromChina] = useState(true)

  const [form, setForm] = useState({
    description: '',
    expected_delivery: '',
    notes: '',
    origin: 'china',
    destination: 'dk_aalborg',
    china_carrier: '',
    china_tracking_number: '',
    china_tracking_url: '',
    eu_carrier: '',
    eu_tracking_number: '',
    eu_tracking_url: '',
  })

  // Orders
  const [allOrders, setAllOrders] = useState<{ id: string; code: string; status: string; supplier: { name: string } | null }[]>([])
  const [originalOrderIds, setOriginalOrderIds] = useState<string[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])

  // Samples
  const [allSamples, setAllSamples] = useState<{ id: string; code: string; status: string; product_variants: { name: string; products: { name: string } | null } | null }[]>([])
  const [originalSampleIds, setOriginalSampleIds] = useState<string[]>([])
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([])

  // Components
  const [allComponents, setAllComponents] = useState<{ id: string; code: string; name: string; unit: string }[]>([])
  const [originalItems, setOriginalItems] = useState<Record<string, { itemId: string; qty: number }>>({})
  const [materialQtys, setMaterialQtys] = useState<Record<string, number>>({})

  useEffect(() => {
    params.then(async p => {
      setId(p.id)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/shipments/${p.id}`); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if ((profile as any)?.role !== 'admin') {
        router.replace(`/shipments/${p.id}`)
        return
      }
      const [
        { data: shipment },
        { data: linkedOrders },
        { data: linkedSamples },
        { data: linkedItems },
        { data: ordersData },
        { data: samplesData },
        { data: componentsData },
      ] = await Promise.all([
        supabase.from('shipments').select('*').eq('id', p.id).single(),
        supabase.from('shipment_orders').select('order_id').eq('shipment_id', p.id),
        supabase.from('shipment_samples').select('sample_id').eq('shipment_id', p.id),
        supabase.from('shipment_items').select('id, component_id, quantity_shipped').eq('shipment_id', p.id),
        supabase.from('purchase_orders').select('id, code, status, supplier:suppliers(name)').order('created_at', { ascending: false }),
        supabase.from('samples').select('id, code, status, product_variants(name, products(name))').not('status', 'in', '(scrapped)').order('created_at', { ascending: false }),
        supabase.from('components').select('id, code, name, unit').order('name'),
      ])
      if (!shipment) { router.replace('/shipments'); return }
      const s = shipment as any
      setShipmentType(s.shipment_type ?? 'component_order')
      const fromChina = !s.origin || s.origin === 'china' || s.origin.startsWith('cn_')
      setIsFromChina(fromChina)
      setForm({
        description: s.description ?? '',
        expected_delivery: s.expected_delivery ?? '',
        notes: s.notes ?? '',
        origin: s.origin ?? 'china',
        destination: s.destination ?? 'dk_aalborg',
        china_carrier: s.china_carrier ?? '',
        china_tracking_number: s.china_tracking_number ?? '',
        china_tracking_url: s.china_tracking_url ?? '',
        eu_carrier: s.eu_carrier ?? '',
        eu_tracking_number: s.eu_tracking_number ?? '',
        eu_tracking_url: s.eu_tracking_url ?? '',
      })
      const orderIds: string[] = (linkedOrders ?? []).map((r: any) => r.order_id as string)
      if (s.order_id && !orderIds.includes(s.order_id)) orderIds.push(s.order_id)
      setOriginalOrderIds(orderIds)
      setSelectedOrderIds([...orderIds])
      const sampleIds: string[] = (linkedSamples ?? []).map((r: any) => r.sample_id as string)
      setOriginalSampleIds(sampleIds)
      setSelectedSampleIds([...sampleIds])
      const origItems: Record<string, { itemId: string; qty: number }> = {}
      const initQtys: Record<string, number> = {}
      ;(linkedItems ?? []).forEach((r: any) => {
        origItems[r.component_id] = { itemId: r.id, qty: r.quantity_shipped }
        initQtys[r.component_id] = r.quantity_shipped
      })
      setOriginalItems(origItems)
      setMaterialQtys(initQtys)
      setAllOrders((ordersData ?? []) as any)
      setAllSamples((samplesData ?? []) as any)
      setAllComponents((componentsData ?? []) as any)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(field: string, value: string) {
    if (field === 'origin') setIsFromChina(value === 'china' || value.startsWith('cn_'))
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleOrder(oid: string) {
    setSelectedOrderIds(prev => prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid])
  }
  function toggleSample(sid: string) {
    setSelectedSampleIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }
  function toggleMaterial(cid: string) {
    setMaterialQtys(prev => {
      const next = { ...prev }
      if (cid in next) { delete next[cid] } else { next[cid] = 1 }
      return next
    })
  }
  function setMaterialQty(cid: string, qty: number) {
    setMaterialQtys(prev => ({ ...prev, [cid]: Math.max(1, qty) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await (supabase.from('shipments') as any).update({
      description: form.description || null,
      expected_delivery: form.expected_delivery || null,
      notes: form.notes || null,
      origin: form.origin || null,
      destination: form.destination || null,
      china_carrier: isFromChina ? (form.china_carrier || null) : null,
      china_tracking_number: isFromChina ? (form.china_tracking_number || null) : null,
      china_tracking_url: isFromChina ? (form.china_tracking_url || null) : null,
      eu_carrier: form.eu_carrier || null,
      eu_tracking_number: form.eu_tracking_number || null,
      eu_tracking_url: form.eu_tracking_url || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }

    if (shipmentType === 'component_order') {
      const toAdd = selectedOrderIds.filter(oid => !originalOrderIds.includes(oid))
      const toRemove = originalOrderIds.filter(oid => !selectedOrderIds.includes(oid))
      await Promise.all([
        toAdd.length > 0
          ? (supabase.from('shipment_orders') as any).insert(toAdd.map(oid => ({ shipment_id: id, order_id: oid })))
          : Promise.resolve(),
        toRemove.length > 0
          ? (supabase.from('shipment_orders') as any).delete().eq('shipment_id', id).in('order_id', toRemove)
          : Promise.resolve(),
      ])
      await (supabase.from('shipments') as any).update({ order_id: selectedOrderIds[0] ?? null }).eq('id', id)
    }

    if (shipmentType === 'sample_transfer') {
      const toAdd = selectedSampleIds.filter(sid => !originalSampleIds.includes(sid))
      const toRemove = originalSampleIds.filter(sid => !selectedSampleIds.includes(sid))
      await Promise.all([
        toAdd.length > 0
          ? (supabase.from('shipment_samples') as any).insert(toAdd.map(sid => ({ shipment_id: id, sample_id: sid })))
          : Promise.resolve(),
        toRemove.length > 0
          ? (supabase.from('shipment_samples') as any).delete().eq('shipment_id', id).in('sample_id', toRemove)
          : Promise.resolve(),
      ])
    }

    if (shipmentType === 'material_transfer') {
      const selectedCids = Object.keys(materialQtys)
      const toRemoveCids = Object.keys(originalItems).filter(cid => !selectedCids.includes(cid))
      const ops: Promise<unknown>[] = []
      if (toRemoveCids.length > 0) {
        ops.push((supabase.from('shipment_items') as any).delete().eq('shipment_id', id).in('component_id', toRemoveCids))
      }
      for (const cid of selectedCids) {
        const qty = materialQtys[cid]
        if (cid in originalItems) {
          ops.push((supabase.from('shipment_items') as any).update({ quantity_shipped: qty }).eq('id', originalItems[cid].itemId))
        } else {
          ops.push((supabase.from('shipment_items') as any).insert({ shipment_id: id, component_id: cid, quantity_shipped: qty }))
        }
      }
      await Promise.all(ops)
    }

    router.push(`/shipments/${id}`)
    router.refresh()
  }

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading…</div>

  const TYPE_LABEL: Record<string, string> = {
    component_order: '📦 Component Order',
    sample_transfer: '🧪 Sample Transfer',
    material_transfer: '🏭 Material Transfer',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={`/shipments/${id}`} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shipment
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Shipment</h1>
        <span className="text-sm text-[var(--muted-foreground)] bg-[var(--accent)] px-3 py-1 rounded-full">
          {TYPE_LABEL[shipmentType] ?? shipmentType}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Origin</label>
              <LocationSelect id="origin" value={form.origin} onChange={v => set('origin', v)} placeholder="Select origin" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Destination</label>
              <LocationSelect id="destination" value={form.destination} onChange={v => set('destination', v)} placeholder="Select destination" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Optional description"
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Delivery</label>
              <input type="date" value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
          </CardContent>
        </Card>

        {shipmentType === 'component_order' && (
          <Card>
            <CardHeader><CardTitle>Linked Orders</CardTitle></CardHeader>
            <CardContent>
              {allOrders.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No orders found.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {allOrders.map(o => (
                    <label key={o.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                      <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleOrder(o.id)}
                        className="rounded border-[var(--border)]" />
                      <span className="font-mono text-sm">{o.code}</span>
                      {o.supplier && <span className="text-sm text-[var(--muted-foreground)]">{o.supplier.name}</span>}
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-[var(--accent)] capitalize">{o.status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {shipmentType === 'sample_transfer' && (
          <Card>
            <CardHeader><CardTitle>Linked Samples</CardTitle></CardHeader>
            <CardContent>
              {allSamples.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No samples found.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {allSamples.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                      <input type="checkbox" checked={selectedSampleIds.includes(s.id)} onChange={() => toggleSample(s.id)}
                        className="rounded border-[var(--border)]" />
                      <span className="font-mono text-sm">{s.code}</span>
                      {s.product_variants && (
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {s.product_variants.name}
                          {s.product_variants.products ? ' · ' + s.product_variants.products.name : ''}
                        </span>
                      )}
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-[var(--accent)] capitalize">{s.status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {shipmentType === 'material_transfer' && (
          <Card>
            <CardHeader><CardTitle>Materials</CardTitle></CardHeader>
            <CardContent>
              {allComponents.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No components found.</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {allComponents.map(c => {
                    const checked = c.id in materialQtys
                    const qty = materialQtys[c.id] ?? 1
                    return (
                      <div key={c.id} className={'flex items-center gap-3 p-2 rounded-lg ' + (checked ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]/50')}>
                        <input type="checkbox" checked={checked} onChange={() => toggleMaterial(c.id)}
                          className="rounded border-[var(--border)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs font-mono text-[var(--muted-foreground)]">{c.code}</p>
                        </div>
                        {checked && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => setMaterialQty(c.id, qty - 1)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--border)] hover:bg-white">
                              <Minus className="w-3 h-3" />
                            </button>
                            <input type="number" min={1} value={qty}
                              onChange={e => setMaterialQty(c.id, parseInt(e.target.value) || 1)}
                              className="w-16 text-center border border-[var(--border)] rounded px-1 py-0.5 text-sm bg-[var(--background)]" />
                            <button type="button" onClick={() => setMaterialQty(c.id, qty + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--border)] hover:bg-white">
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-xs text-[var(--muted-foreground)] w-8">{c.unit}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isFromChina && (
          <Card>
            <CardHeader><CardTitle>China Leg</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Carrier</label>
                <input type="text" value={form.china_carrier} onChange={e => set('china_carrier', e.target.value)}
                  placeholder="e.g. DHL Express"
                  className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
                <input type="text" value={form.china_tracking_number} onChange={e => set('china_tracking_number', e.target.value)}
                  className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono bg-[var(--background)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Tracking URL</label>
                <input type="url" value={form.china_tracking_url} onChange={e => set('china_tracking_url', e.target.value)}
                  className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{isFromChina ? 'EU Leg' : 'Carrier'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Carrier</label>
              <input type="text" value={form.eu_carrier} onChange={e => set('eu_carrier', e.target.value)}
                placeholder="e.g. PostNord, GLS"
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
              <input type="text" value={form.eu_tracking_number} onChange={e => set('eu_tracking_number', e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tracking URL</label>
              <input type="url" value={form.eu_tracking_url} onChange={e => set('eu_tracking_url', e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        <div className="flex gap-3 justify-end pb-8">
          <Link href={`/shipments/${id}`}><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </form>
    </div>
  )
}
