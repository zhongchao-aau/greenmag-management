'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import Link from 'next/link'

// âââ Location data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const PREFERRED_LOCS = [
  { value: 'china',      label: 'China' },
  { value: 'dk_aalborg', label: 'Aalborg, Denmark' },
  { value: 'dk_hammel',  label: 'Hammel, Denmark' },
  { value: 'lv',         label: 'Latvia' },
]
const CHINA_PROVINCES = [
  { value: 'cn_beijing',        label: 'Beijing' },
  { value: 'cn_chongqing',      label: 'Chongqing' },
  { value: 'cn_shanghai',       label: 'Shanghai' },
  { value: 'cn_tianjin',        label: 'Tianjin' },
  { value: 'cn_anhui',          label: 'Anhui' },
  { value: 'cn_fujian',         label: 'Fujian' },
  { value: 'cn_gansu',          label: 'Gansu' },
  { value: 'cn_guangdong',      label: 'Guangdong' },
  { value: 'cn_guizhou',        label: 'Guizhou' },
  { value: 'cn_hainan',         label: 'Hainan' },
  { value: 'cn_hebei',          label: 'Hebei' },
  { value: 'cn_heilongjiang',   label: 'Heilongjiang' },
  { value: 'cn_henan',          label: 'Henan' },
  { value: 'cn_hubei',          label: 'Hubei' },
  { value: 'cn_hunan',          label: 'Hunan' },
  { value: 'cn_jiangsu',        label: 'Jiangsu' },
  { value: 'cn_jiangxi',        label: 'Jiangxi' },
  { value: 'cn_jilin',          label: 'Jilin' },
  { value: 'cn_liaoning',       label: 'Liaoning' },
  { value: 'cn_qinghai',        label: 'Qinghai' },
  { value: 'cn_shaanxi',        label: 'Shaanxi' },
  { value: 'cn_shandong',       label: 'Shandong' },
  { value: 'cn_shanxi',         label: 'Shanxi' },
  { value: 'cn_sichuan',        label: 'Sichuan' },
  { value: 'cn_yunnan',         label: 'Yunnan' },
  { value: 'cn_zhejiang',       label: 'Zhejiang' },
  { value: 'cn_guangxi',        label: 'Guangxi' },
  { value: 'cn_inner_mongolia', label: 'Inner Mongolia' },
  { value: 'cn_ningxia',        label: 'Ningxia' },
  { value: 'cn_tibet',          label: 'Tibet' },
  { value: 'cn_xinjiang',       label: 'Xinjiang' },
  { value: 'cn_hongkong',       label: 'Hong Kong' },
  { value: 'cn_macau',          label: 'Macau' },
]
const WORLD_LOCS = [
  { value: 'at',          label: 'Austria' },
  { value: 'be',          label: 'Belgium' },
  { value: 'cz',          label: 'Czech Republic' },
  { value: 'dk',          label: 'Denmark' },
  { value: 'dk_cph',      label: 'Copenhagen, Denmark' },
  { value: 'ee',          label: 'Estonia' },
  { value: 'fi',          label: 'Finland' },
  { value: 'fr',          label: 'France' },
  { value: 'de',          label: 'Germany' },
  { value: 'de_berlin',   label: 'Berlin, Germany' },
  { value: 'de_hamburg',  label: 'Hamburg, Germany' },
  { value: 'de_munich',   label: 'Munich, Germany' },
  { value: 'hu',          label: 'Hungary' },
  { value: 'ie',          label: 'Ireland' },
  { value: 'it',          label: 'Italy' },
  { value: 'jp',          label: 'Japan' },
  { value: 'kr',          label: 'South Korea' },
  { value: 'lv_riga',     label: 'Riga, Latvia' },
  { value: 'lt',          label: 'Lithuania' },
  { value: 'nl',          label: 'Netherlands' },
  { value: 'no',          label: 'Norway' },
  { value: 'pl',          label: 'Poland' },
  { value: 'pt',          label: 'Portugal' },
  { value: 'ro',          label: 'Romania' },
  { value: 'sg',          label: 'Singapore' },
  { value: 'sk',          label: 'Slovakia' },
  { value: 'es',          label: 'Spain' },
  { value: 'se',          label: 'Sweden' },
  { value: 'ch',          label: 'Switzerland' },
  { value: 'tw',          label: 'Taiwan' },
  { value: 'gb',          label: 'United Kingdom' },
  { value: 'gb_london',   label: 'London, UK' },
  { value: 'ua',          label: 'Ukraine' },
  { value: 'us',          label: 'United States' },
  { value: 'us_ny',       label: 'New York, USA' },
  { value: 'us_la',       label: 'Los Angeles, USA' },
  { value: 'ca',          label: 'Canada' },
  { value: 'au',          label: 'Australia' },
  { value: 'in_india',    label: 'India' },
]

export const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  [...PREFERRED_LOCS, ...CHINA_PROVINCES, ...WORLD_LOCS].map(l => [l.value, l.label])
)

function LocationSelect({ id, value, onChange, placeholder = 'Not specified' }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]">
      <option value="">{'â ' + placeholder + ' â'}</option>
      <optgroup label="Preferred">
        {PREFERRED_LOCS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
      <optgroup label="China â by Province / Region">
        {CHINA_PROVINCES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
      <optgroup label="Europe & World">
        {WORLD_LOCS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </optgroup>
    </select>
  )
}

type ShipmentType = 'component_order' | 'sample_transfer' | 'material_transfer'

export default function NewShipmentPage() {
  const router = useRouter()
  const params = useSearchParams()
  const preOrderId = params.get('order')
  const supabase = createClient()

  const [shipmentType, setShipmentType] = useState<ShipmentType>('component_order')
  const [origin, setOrigin] = useState('china')
  const [destination, setDestination] = useState('dk_aalborg')
  const [description, setDescription] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [notes, setNotes] = useState('')
  const [chinaCarrier, setChinaCarrier] = useState('')
  const [chinaTN, setChinaTN] = useState('')
  const [chinaTU, setChinaTU] = useState('')
  const [euCarrier, setEuCarrier] = useState('')
  const [euTN, setEuTN] = useState('')
  const [euTU, setEuTU] = useState('')
  const [orders, setOrders] = useState<{ id: string; code: string; status: string; supplier: { name: string } | null }[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(preOrderId ? [preOrderId] : [])
  const [samples, setSamples] = useState<{ id: string; code: string; status: string; product_variants: { name: string; products: { name: string } | null } | null }[]>([])
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([])
  const [components, setComponents] = useState<{ id: string; code: string; name: string; unit: string }[]>([])
  const [materialQtys, setMaterialQtys] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFromChina = origin === 'china' || origin.startsWith('cn_')

  useEffect(() => {
    async function load() {
      const [ordersRes, samplesRes, componentsRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, code, status, supplier:suppliers(name)')
          .not('status', 'in', '(completed,cancelled,closed,fully_received)')
          .order('created_at', { ascending: false }),
        supabase
          .from('samples')
          .select('id, code, status, product_variants(name, products(name))')
          .not('status', 'in', '(scrapped)')
          .order('created_at', { ascending: false }),
        supabase
          .from('components')
          .select('id, code, name, unit')
          .order('name'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderData = (ordersRes.data ?? []) as any[]
      if (preOrderId && !orderData.find((o: any) => o.id === preOrderId)) {
        const { data: preOrder } = await supabase
          .from('purchase_orders')
          .select('id, code, status, supplier:suppliers(name)')
          .eq('id', preOrderId)
          .single()
        if (preOrder) {
          orderData = [(preOrder as any), ...orderData]
        }
      }
      setOrders(orderData as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSamples((samplesRes.data ?? []) as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setComponents((componentsRes.data ?? []) as any)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleOrder(id: string) {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleSample(id: string) {
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleMaterial(componentId: string) {
    setMaterialQtys(prev => {
      const next = { ...prev }
      if (componentId in next) { delete next[componentId] } else { next[componentId] = 1 }
      return next
    })
  }
  function setMaterialQty(componentId: string, qty: number) {
    setMaterialQtys(prev => ({ ...prev, [componentId]: Math.max(1, qty) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { data, error: err } = await supabase.from('shipments').insert({
      description: description || null,
      expected_delivery: expectedDelivery || null,
      notes: notes || null,
      shipment_type: shipmentType,
      origin: origin || null,
      destination: destination || null,
      china_carrier: isFromChina ? (chinaCarrier || null) : null,
      china_tracking_number: isFromChina ? (chinaTN || null) : null,
      china_tracking_url: isFromChina ? (chinaTU || null) : null,
      eu_carrier: euCarrier || null,
      eu_tracking_number: euTN || null,
      eu_tracking_url: euTU || null,
    }).select('id').single()

    if (err || !data) {
      setError(err?.message ?? 'Failed to create shipment')
      setSubmitting(false)
      return
    }

    const shipmentId = (data as { id: string }).id

    if (shipmentType === 'component_order' && selectedOrderIds.length > 0) {
      const rows = selectedOrderIds.map(oid => ({ shipment_id: shipmentId, order_id: oid }))
      await supabase.from('shipment_orders').insert(rows)
      await supabase.from('shipments').update({ order_id: selectedOrderIds[0] }).eq('id', shipmentId)
    }

    if (shipmentType === 'sample_transfer' && selectedSampleIds.length > 0) {
      const rows = selectedSampleIds.map(sid => ({ shipment_id: shipmentId, sample_id: sid }))
      await supabase.from('shipment_samples').insert(rows)
    }

    if (shipmentType === 'material_transfer') {
      const rows = Object.entries(materialQtys)
        .filter(([, qty]) => qty > 0)
        .map(([componentId, qty]) => ({
          shipment_id: shipmentId,
          component_id: componentId,
          quantity_shipped: qty,
        }))
      if (rows.length > 0) {
        await supabase.from('shipment_items').insert(rows)
      }
    }

    router.push('/shipments/' + shipmentId)
  }

  const TYPES = [
    { value: 'component_order' as ShipmentType,   label: 'Component Order',   emoji: 'ð¦' },
    { value: 'sample_transfer' as ShipmentType,   label: 'Sample Transfer',   emoji: 'ð§ª' },
    { value: 'material_transfer' as ShipmentType, label: 'Material Transfer', emoji: 'ð­' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shipments
      </Link>
      <h1 className="text-2xl font-bold mb-6">New Shipment</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <Card>
          <CardHeader><CardTitle>Shipment Type</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setShipmentType(t.value)}
                  className={'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ' + (shipmentType === t.value ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--accent)]')}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="origin">Origin</label>
              <LocationSelect id="origin" value={origin} onChange={setOrigin} placeholder="Select origin" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="destination">Destination</label>
              <LocationSelect id="destination" value={destination} onChange={setDestination} placeholder="Select destination" />
            </div>
          </CardContent>
        </Card>

        {isFromChina && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            Origin is in China â two tracking legs will be recorded (China leg + EU/international leg).
          </p>
        )}

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Delivery</label>
              <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
          </CardContent>
        </Card>

        {shipmentType === 'component_order' && (
          <Card>
            <CardHeader><CardTitle>Linked Orders</CardTitle></CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No open orders found.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {orders.map(o => (
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
              {samples.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No samples found.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {samples.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                      <input type="checkbox" checked={selectedSampleIds.includes(s.id)} onChange={() => toggleSample(s.id)}
                        className="rounded border-[var(--border)]" />
                      <span className="font-mono text-sm">{s.code}</span>
                      {s.product_variants && (
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {s.product_variants.name}
                          {s.product_variants.products ? ' Â· ' + s.product_variants.products.name : ''}
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
            <CardHeader><CardTitle>Materials to Transfer</CardTitle></CardHeader>
            <CardContent>
              {components.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No components found.</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {components.map(c => {
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
                <input type="text" value={chinaCarrier} onChange={e => setChinaCarrier(e.target.value)} placeholder="e.g. DHL Express"
                  className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
                <input type="text" value={chinaTN} onChange={e => setChinaTN(e.target.value)}
                  className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono bg-[var(--background)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Tracking URL</label>
                <input type="url" value={chinaTU} onChange={e => setChinaTU(e.target.value)}
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
              <input type="text" value={euCarrier} onChange={e => setEuCarrier(e.target.value)} placeholder="e.g. PostNord, GLS"
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
              <input type="text" value={euTN} onChange={e => setEuTN(e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono bg-[var(--background)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tracking URL</label>
              <input type="url" value={euTU} onChange={e => setEuTU(e.target.value)}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]" />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pb-8">
          <Link href="/shipments"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creatingâ¦' : 'Create Shipment'}</Button>
        </div>

      </form>
    </div>
  )
}
