import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { AlertTriangle, ShoppingCart, Truck, Wrench } from 'lucide-react'
import { formatQuantity } from '@/lib/utils'
import { LOCATION_LABELS } from '@/lib/locations'
export const dynamic = 'force-dynamic'

const FILTER_TABS = [
  { value: '', label: 'All Items' },
  { value: 'low', label: '⚠️ Low Stock' },
  { value: 'zero', label: '🔴 Out of Stock' },
]

const TYPE_TABS = [
  { value: '', label: 'All Types' },
  { value: 'raw_material', label: 'Materials' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'consumable', label: 'Consumables' },
]

// Orders that are active (placed but not yet fully received)
const ACTIVE_ORDER_STATUSES = ['approved', 'ordered', 'confirmed', 'partially_shipped', 'shipped', 'partially_received']
// Shipments that are in transit (not yet delivered)
const ACTIVE_SHIPMENT_STATUSES = ['dispatched', 'in_transit', 'customs', 'out_for_delivery']
// Build requests that are active (components reserved)
const ACTIVE_BUILD_STATUSES = ['submitted', 'under_review', 'approved']

const TYPE_LABELS: Record<string, { label: string; prefix: string; color: string }> = {
  raw_material: { label: 'Raw Materials', prefix: 'RM', color: 'text-blue-700 dark:text-blue-400' },
  equipment:    { label: 'Lab Equipment', prefix: 'EQ', color: 'text-violet-700 dark:text-violet-400' },
  consumable:   { label: 'Consumables & Supplies', prefix: 'CS', color: 'text-amber-700 dark:text-amber-400' },
}
const TYPE_ORDER = ['raw_material', 'equipment', 'consumable']

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string; type?: string }> }) {
  const { filter: filterParam, type: typeParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Load ALL components (not just those with inventory) + inventory balances
  const { data: components } = await supabase
    .from('components')
    .select('id, code, name, unit, low_stock_threshold, component_type, location, supplier:suppliers(name)')
    .eq('is_active', true)
    .order('code', { ascending: true })

  const { data: balances } = await supabase
    .from('inventory_balances')
    .select('component_id, quantity')

  // Load order items for on-order quantities
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('component_id, quantity_ordered, quantity_received, order:purchase_orders(status)')

  // Load shipment items for in-transit quantities
  const { data: shipmentItems } = await supabase
    .from('shipment_items')
    .select('component_id, quantity_shipped, shipment:shipments(status)')

  // Load request items from active build requests for reserved quantities
  const { data: buildRequestItems } = await supabase
    .from('request_items')
    .select('component_id, quantity_requested, request:purchase_requests(status, request_type)')

  // Build lookup maps
  const balanceMap: Record<string, number> = {}
  for (const b of balances ?? []) {
    if (b.component_id) balanceMap[b.component_id] = b.quantity ?? 0
  }

  const onOrderMap: Record<string, number> = {}
  for (const item of orderItems ?? []) {
    const orderStatus = (item.order as { status: string } | null)?.status ?? ''
    if (item.component_id && ACTIVE_ORDER_STATUSES.includes(orderStatus)) {
      const outstanding = Math.max(0, (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0))
      onOrderMap[item.component_id] = (onOrderMap[item.component_id] ?? 0) + outstanding
    }
  }

  const inTransitMap: Record<string, number> = {}
  for (const item of shipmentItems ?? []) {
    const shipStatus = (item.shipment as { status: string } | null)?.status ?? ''
    if (item.component_id && ACTIVE_SHIPMENT_STATUSES.includes(shipStatus)) {
      inTransitMap[item.component_id] = (inTransitMap[item.component_id] ?? 0) + (item.quantity_shipped ?? 0)
    }
  }

  const reservedMap: Record<string, number> = {}
  for (const item of buildRequestItems ?? []) {
    const req = item.request as { status: string; request_type: string } | null
    if (item.component_id && req?.request_type === 'build' && ACTIVE_BUILD_STATUSES.includes(req.status)) {
      reservedMap[item.component_id] = (reservedMap[item.component_id] ?? 0) + (item.quantity_requested ?? 0)
    }
  }

  const activeFilter = filterParam ?? ''
  const activeType = typeParam ?? ''

  // URL helpers that preserve both params
  function typeUrl(t: string) {
    const params = new URLSearchParams()
    if (t) params.set('type', t)
    if (activeFilter) params.set('filter', activeFilter)
    const qs = params.toString()
    return `/inventory${qs ? '?' + qs : ''}`
  }
  function filterUrl(f: string) {
    const params = new URLSearchParams()
    if (activeType) params.set('type', activeType)
    if (f) params.set('filter', f)
    const qs = params.toString()
    return `/inventory${qs ? '?' + qs : ''}`
  }

  // Build enriched component list from the components table (shows all even with no inventory)
  const enriched = (components ?? []).map((c: {
    id: string; code: string; name: string; unit: string;
    low_stock_threshold: number | null; component_type: string | null;
    location: string | null; supplier: { name: string } | null
  }) => {
    const qty = balanceMap[c.id] ?? 0
    const onOrder = onOrderMap[c.id] ?? 0
    const inTransit = inTransitMap[c.id] ?? 0
    const reserved = reservedMap[c.id] ?? 0
    const isZero = qty <= 0
    const isLow = !isZero && c.low_stock_threshold != null && qty < c.low_stock_threshold
    return { ...c, qty, onOrder, inTransit, reserved, isZero, isLow }
  })

  // Apply filters
  const filtered = enriched.filter(c => {
    if (activeType && c.component_type !== activeType) return false
    if (activeFilter === 'low') return c.qty > 0 && c.low_stock_threshold != null && c.qty < c.low_stock_threshold
    if (activeFilter === 'zero') return c.qty <= 0
    return true
  })

  // Group by component_type
  const grouped: Record<string, typeof filtered> = {}
  for (const c of filtered) {
    const t = c.component_type ?? 'raw_material'
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(c)
  }

  const totalCount = filtered.length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{totalCount} component{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/usage/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-md hover:opacity-90 transition-opacity"
        >
          Record Usage
        </Link>
      </div>

      {/* Type filter row */}
      <div className="flex gap-1 mb-0 border-b border-[var(--border)] overflow-x-auto">
        {TYPE_TABS.map(tab => (
          <Link
            key={tab.value}
            href={typeUrl(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeType === tab.value
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Status filter row */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border)] overflow-x-auto">
        {FILTER_TABS.map(tab => (
          <Link
            key={tab.value}
            href={filterUrl(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeFilter === tab.value
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {totalCount === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No components found"
            description="No components match the current filter."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.filter(t => (grouped[t]?.length ?? 0) > 0).map(typeKey => {
            const meta = TYPE_LABELS[typeKey]
            const rows = grouped[typeKey]
            return (
              <div key={typeKey}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h2>
                  <span className="text-xs text-[var(--muted-foreground)]">({rows.length})</span>
                </div>
                <div className="card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">In Stock</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <ShoppingCart className="w-3 h-3" />On Order
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Truck className="w-3 h-3" />In Transit
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Wrench className="w-3 h-3" />Reserved
                          </span>
                        </TableHead>
                        <TableHead className="text-right">Threshold</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(c => (
                        <TableRow key={c.id} className={c.isZero ? 'bg-red-50 dark:bg-red-950/20' : c.isLow ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                          <TableCell>
                            <div>
                              <Link href={`/components/${c.id}`} className="text-sm font-medium hover:text-[var(--primary)]">
                                {c.name}
                              </Link>
                              <p className="text-xs font-mono text-[var(--muted-foreground)]">{c.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[var(--muted-foreground)]">
                            {(c.supplier as { name: string } | null)?.name ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-[var(--muted-foreground)]">
                            {c.location ? (LOCATION_LABELS[c.location] ?? c.location) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{c.unit}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${c.isZero ? 'text-red-600' : c.isLow ? 'text-amber-600' : ''}`}>
                            {formatQuantity(c.qty)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {c.onOrder > 0
                              ? <span className="text-blue-600 dark:text-blue-400 font-medium">+{formatQuantity(c.onOrder)}</span>
                              : <span className="text-[var(--muted-foreground)]">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {c.inTransit > 0
                              ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">+{formatQuantity(c.inTransit)}</span>
                              : <span className="text-[var(--muted-foreground)]">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {c.reserved > 0
                              ? <span className="text-orange-600 dark:text-orange-400 font-medium">{formatQuantity(c.reserved)}</span>
                              : <span className="text-[var(--muted-foreground)]">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm text-[var(--muted-foreground)]">
                            {c.low_stock_threshold != null ? formatQuantity(c.low_stock_threshold) : '—'}
                          </TableCell>
                          <TableCell>
                            {c.isZero ? (
                              <Badge className="badge-cancelled text-xs">Out of Stock</Badge>
                            ) : c.isLow ? (
                              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs">
                                <AlertTriangle className="w-3 h-3" />Low
                              </span>
                            ) : (
                              <Badge className="badge-approved text-xs">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
