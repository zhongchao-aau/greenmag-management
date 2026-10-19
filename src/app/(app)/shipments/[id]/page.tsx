import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ExternalLink, Truck, Package, ArrowRight, FlaskConical } from 'lucide-react'
import { shipmentStatusClass, SHIPMENT_STATUS_LABELS, formatDate, formatQuantity } from '@/lib/utils'
import { ShipmentActions } from './shipment-actions'
import { ReceivingForm } from './receiving-form'
export const dynamic = 'force-dynamic'

const LOCATION_LABELS: Record<string, string> = {
  china: 'China', dk_aalborg: 'Aalborg, DK', dk_hammel: 'Hammel, DK', lv: 'Latvia',
  cn_beijing: 'Beijing', cn_chongqing: 'Chongqing', cn_shanghai: 'Shanghai', cn_tianjin: 'Tianjin',
  cn_anhui: 'Anhui', cn_fujian: 'Fujian', cn_gansu: 'Gansu', cn_guangdong: 'Guangdong',
  cn_guizhou: 'Guizhou', cn_hainan: 'Hainan', cn_hebei: 'Hebei', cn_heilongjiang: 'Heilongjiang',
  cn_henan: 'Henan', cn_hubei: 'Hubei', cn_hunan: 'Hunan', cn_jiangsu: 'Jiangsu',
  cn_jiangxi: 'Jiangxi', cn_jilin: 'Jilin', cn_liaoning: 'Liaoning', cn_qinghai: 'Qinghai',
  cn_shaanxi: 'Shaanxi', cn_shandong: 'Shandong', cn_shanxi: 'Shanxi', cn_sichuan: 'Sichuan',
  cn_yunnan: 'Yunnan', cn_zhejiang: 'Zhejiang', cn_guangxi: 'Guangxi',
  cn_inner_mongolia: 'Inner Mongolia', cn_ningxia: 'Ningxia', cn_tibet: 'Tibet',
  cn_xinjiang: 'Xinjiang', cn_hongkong: 'Hong Kong', cn_macau: 'Macau',
  at: 'Austria', be: 'Belgium', cz: 'Czech Republic', dk: 'Denmark', dk_cph: 'Copenhagen, DK',
  ee: 'Estonia', fi: 'Finland', fr: 'France', de: 'Germany', de_berlin: 'Berlin, DE',
  de_hamburg: 'Hamburg, DE', de_munich: 'Munich, DE', hu: 'Hungary', ie: 'Ireland',
  it: 'Italy', jp: 'Japan', kr: 'South Korea', lv_riga: 'Riga, Latvia', lt: 'Lithuania',
  nl: 'Netherlands', no: 'Norway', pl: 'Poland', pt: 'Portugal', ro: 'Romania',
  sg: 'Singapore', sk: 'Slovakia', es: 'Spain', se: 'Sweden', ch: 'Switzerland',
  tw: 'Taiwan', gb: 'United Kingdom', gb_london: 'London, UK', ua: 'Ukraine',
  us: 'United States', us_ny: 'New York, USA', us_la: 'Los Angeles, USA',
  ca: 'Canada', au: 'Australia', in_india: 'India',
}

const SHIPMENT_TYPE_LABELS: Record<string, string> = {
  component_order:  'Component Order',
  sample_transfer:  'Sample Transfer',
  material_transfer: 'Material Transfer',
}

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() as any
  const profile = profileData as { role: string } | null
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentData } = await (supabase
    .from('shipments')
    .select(`
      *,
      order:purchase_orders(id, code, supplier:suppliers(name))
    `)
    .eq('id', id)
    .single() as any)
  const shipment = shipmentData as {
    id: string; code: string; description: string | null; status: string;
    has_exception: boolean; exception_notes: string | null;
    expected_delivery: string | null; actual_delivery: string | null; notes: string | null;
    china_carrier: string | null; china_tracking_number: string | null; china_tracking_url: string | null; china_status: string | null;
    eu_carrier: string | null; eu_tracking_number: string | null; eu_tracking_url: string | null; eu_status: string | null;
    origin: string | null; destination: string | null; shipment_type: string | null;
    order: { id: string; code: string; supplier: { name: string } | null } | null;
  } | null

  if (!shipment) notFound()

  const isFromChina = shipment.origin != null && (shipment.origin === 'china' || shipment.origin.startsWith('cn_'))

  const [{ data: items }, { data: events }, { data: linkedOrdersData }, { data: linkedSamplesData }] = await Promise.all([
    supabase.from('shipment_items')
      .select('id, quantity_shipped, component:components(id, code, name, unit)')
      .eq('shipment_id', id),
    supabase.from('shipment_events')
      .select('id, event_date, location, description, tracking_leg, created_at')
      .eq('shipment_id', id)
      .order('event_date', { ascending: false }),
    supabase.from('shipment_orders')
      .select('order_id')
      .eq('shipment_id', id),
    supabase.from('shipment_samples')
      .select('sample:samples(id, code, status, product_variants(name, products(name)))')
      .eq('shipment_id', id),
  ])

  type LinkedOrder = { id: string; code: string; supplier: { name: string } | null }
  const linkedOrderIdSet = new Set<string>()
  ;(linkedOrdersData ?? []).forEach((row: { order_id: string }) => {
    if (row.order_id) linkedOrderIdSet.add(row.order_id)
  })
  if (shipment.order?.id) linkedOrderIdSet.add(shipment.order.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let linkedOrders: LinkedOrder[] = []
  if (linkedOrderIdSet.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ordersData } = await (supabase
      .from('purchase_orders')
      .select('id, code, supplier:suppliers(name)')
      .in('id', [...linkedOrderIdSet]) as any)
    linkedOrders = (ordersData ?? []) as LinkedOrder[]
  }

  type LinkedSample = { id: string; code: string; status: string; product_variants: { name: string; products: { name: string } | null } | null }
  const linkedSamples: LinkedSample[] = (linkedSamplesData ?? [])
    .map((row: { sample: unknown }) => row.sample as LinkedSample)
    .filter(Boolean)

  // For component_order shipments with no direct shipment_items, derive from linked orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderDerivedItems: { id: string; quantity_shipped: number; component: { id: string; code: string; name: string; unit: string } | null }[] = []
  if (shipment.shipment_type === 'component_order' && !(items ?? []).length) {
    const orderIds = linkedOrders.map(o => o.id)
    if (orderIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: oiData } = await (supabase
        .from('order_items')
        .select('id, quantity, component:components(id, code, name, unit)')
        .in('order_id', orderIds) as any)
      orderDerivedItems = (oiData ?? []).map((oi: any) => ({
        id: oi.id,
        quantity_shipped: oi.quantity as number,
        component: oi.component as { id: string; code: string; name: string; unit: string } | null,
      }))
    }
  }

  const isDelivered = shipment.status === 'delivered' || shipment.status === 'received'

  // Fetch receipt + full inspection for this shipment
  const { data: receiptData } = await supabase
    .from('receipts')
    .select(`
      id, received_at, notes,
      receipt_items(id, quantity_received, component:components(id, code, name, unit)),
      inspections(id, overall_result, inspected_at, notes,
        items:inspection_items(id, quantity_accepted, quantity_rejected, result, notes,
          component:components(id, code, name, unit)
        )
      )
    `)
    .eq('shipment_id', id)
    .maybeSingle()

  type ReceiptFull = {
    id: string
    received_at: string
    notes: string | null
    receipt_items: { id: string; quantity_received: number; component: { id: string; code: string; name: string; unit: string } | null }[]
    inspections: {
      id: string
      overall_result: string
      inspected_at: string
      notes: string | null
      items: {
        id: string
        quantity_accepted: number
        quantity_rejected: number
        result: string
        notes: string | null
        component: { id: string; code: string; name: string; unit: string } | null
      }[]
    }[]
  }
  const receipt = receiptData as ReceiptFull | null

  type ShipmentItem = {
    id: string
    quantity_shipped: number
    component: { id: string; code: string; name: string; unit: string } | null
  }
  const shipmentItems = ((items ?? []).length > 0 ? (items ?? []) : orderDerivedItems) as ShipmentItem[]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shipments
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="w-full">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Truck className="w-5 h-5 text-[var(--primary)]" />
                    <span className="font-mono text-sm text-[var(--muted-foreground)]">{shipment.code}</span>
                    <Badge className={shipmentStatusClass(shipment.status as never)}>{SHIPMENT_STATUS_LABELS[shipment.status as never]}</Badge>
                    {shipment.shipment_type && (
                      <Badge className="badge-under-review text-xs">{SHIPMENT_TYPE_LABELS[shipment.shipment_type] ?? shipment.shipment_type}</Badge>
                    )}
                  </div>
                  <CardTitle>{shipment.description ?? shipment.code}</CardTitle>
                  {(shipment.origin || shipment.destination) && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-[var(--muted-foreground)]">
                      <span>{LOCATION_LABELS[shipment.origin ?? ''] ?? shipment.origin ?? '—'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{LOCATION_LABELS[shipment.destination ?? ''] ?? shipment.destination ?? '—'}</span>
                    </div>
                  )}
                  {linkedOrders.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {linkedOrders.map(o => (
                        <Link key={o.id} href={`/orders/${o.id}`} className="text-xs text-[var(--primary)] bg-[var(--accent)] rounded px-2 py-0.5 hover:underline font-mono">
                          {o.code}{o.supplier ? ` · ${o.supplier.name}` : ''}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Tracking legs */}
          <div className={`grid grid-cols-1 gap-4 ${isFromChina ? 'sm:grid-cols-2' : ''}`}>
            {isFromChina && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    China Leg
                    {shipment.china_status && (
                      <Badge className="badge-under-review text-xs">{shipment.china_status}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {shipment.china_carrier ? (
                    <>
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)]">Carrier</p>
                        <p className="font-medium">{shipment.china_carrier}</p>
                      </div>
                      {shipment.china_tracking_number && (
                        <div>
                          <p className="text-xs text-[var(--muted-foreground)]">Tracking #</p>
                          <p className="font-mono text-xs">{shipment.china_tracking_number}</p>
                        </div>
                      )}
                      {shipment.china_tracking_url && (
                        <a href={shipment.china_tracking_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--primary)] hover:underline text-xs mt-1">
                          <ExternalLink className="w-3 h-3" />Track on carrier website
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-[var(--muted-foreground)] text-sm">No China leg info yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {isFromChina ? 'EU Leg' : 'Carrier'}
                  {shipment.eu_status && (
                    <Badge className="badge-approved text-xs">{shipment.eu_status}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {shipment.eu_carrier ? (
                  <>
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)]">Carrier</p>
                      <p className="font-medium">{shipment.eu_carrier}</p>
                    </div>
                    {shipment.eu_tracking_number && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)]">Tracking #</p>
                        <p className="font-mono text-xs">{shipment.eu_tracking_number}</p>
                      </div>
                    )}
                    {shipment.eu_tracking_url && (
                      <a href={shipment.eu_tracking_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[var(--primary)] hover:underline text-xs mt-1">
                        <ExternalLink className="w-3 h-3" />Track on carrier website
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-[var(--muted-foreground)] text-sm">{isFromChina ? 'EU carrier not yet assigned.' : 'Carrier not yet assigned.'}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Components — ordered quantities */}
          {shipmentItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-4 h-4" />Components Ordered</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shipmentItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-[var(--muted-foreground)]" />
                        {item.component ? (
                          <div>
                            <Link href={`/components/${item.component.id}`} className="text-sm font-medium hover:text-[var(--primary)]">
                              {item.component.name}
                            </Link>
                            <p className="text-xs font-mono text-[var(--muted-foreground)]">{item.component.code}</p>
                          </div>
                        ) : '—'}
                      </div>
                      <span className="text-sm font-medium text-[var(--muted-foreground)]">
                        {formatQuantity(item.quantity_shipped, item.component?.unit ?? 'pcs')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receiving & Inspection — editable form shown when delivered or receipt exists */}
          {(isDelivered || receipt) && isAdmin && shipmentItems.length > 0 && (
            <ReceivingForm
              shipmentId={id}
              shipmentItems={shipmentItems}
              receipt={receipt}
              isAdmin={isAdmin}
            />
          )}

          {/* Linked samples */}
          {linkedSamples.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="w-4 h-4" />Samples</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedSamples.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-3">
                        <FlaskConical className="w-4 h-4 text-[var(--muted-foreground)]" />
                        <div>
                          <p className="text-sm font-medium">{s.product_variants?.name ?? s.code}</p>
                          <p className="text-xs font-mono text-[var(--muted-foreground)]">{s.code}</p>
                          {s.product_variants?.products?.name && (
                            <p className="text-xs text-[var(--muted-foreground)]">{s.product_variants.products.name}</p>
                          )}
                        </div>
                      </div>
                      <Badge className="badge-under-review text-xs capitalize">{s.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Events timeline */}
          {(events ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Tracking Events</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(events ?? []).map((e: { id: string; event_date: string; location: string | null; description: string; tracking_leg: string }) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                        <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />
                      </div>
                      <div className="pb-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{e.description}</p>
                          <Badge className={e.tracking_leg === 'china' ? 'badge-draft' : 'badge-approved'}>
                            {e.tracking_leg}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {e.location && `${e.location} · `}{formatDate(e.event_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {isAdmin && (
            <>
              <div className="flex justify-end">
                <Link href={`/shipments/${id}/edit`} className="text-xs text-[var(--primary)] hover:underline font-medium">
                  Edit Details
                </Link>
              </div>
              <ShipmentActions
                shipmentId={id}
                status={shipment.status}
                isAdmin={isAdmin}
                hasException={!!shipment.has_exception}
                exceptionNotes={shipment.exception_notes ?? null}
              />
            </>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Expected</span>
                <span>{formatDate(shipment.expected_delivery)}</span>
              </div>
              {shipment.actual_delivery && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Delivered</span>
                  <span className="text-green-700 font-medium">{formatDate(shipment.actual_delivery)}</span>
                </div>
              )}
              {shipment.notes && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">Notes</p>
                  <p className="text-sm">{shipment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
      }
