import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  requestStatusClass, REQUEST_STATUS_LABELS,
  shipmentStatusClass, SHIPMENT_STATUS_LABELS,
  formatDate, formatRelative
} from '@/lib/utils'
import {
  AlertCircle, Bell, CheckCircle2, ClipboardCheck, Package,
  Truck, FileText, ShoppingCart, ArrowRight, AlertTriangle
} from 'lucide-react'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'

  // ---- Fetch dashboard data ----
  const [
    { data: myRequests },
    { data: pendingRequests },
    { data: activeShipments },
    { data: activeOrders },
    { data: deliveredShipmentsRaw },
    { data: receivedShipmentsRaw },
    { data: lowStockItems },
    { data: recentActivity },
  ] = await Promise.all([
    // My recent requests (all users)
    supabase.from('purchase_requests')
      .select('id, code, status, purpose, created_at, updated_at')
      .eq('requester_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5),

    // Requests needing admin attention
    isAdmin
      ? supabase.from('purchase_requests')
          .select('id, code, status, purpose, created_at, requester:profiles!requester_id(full_name)')
          .in('status', ['submitted', 'under_review'])
          .order('created_at', { ascending: true })
          .limit(10)
      : { data: [] },

    // Active shipments (not complete/returned/received)
    supabase.from('shipments')
      .select('id, code, description, status, has_exception, expected_delivery, actual_delivery')
      .not('status', 'in', '("complete","received","returned")')
      .order('expected_delivery', { ascending: true })
      .limit(10),

    // Active orders (not closed)
    supabase.from('purchase_orders')
      .select('id, code, status, supplier:suppliers(name), expected_delivery')
      .not('status', 'in', '("closed","received")')
      .order('expected_delivery', { ascending: true })
      .limit(8),

    // Delivered but not yet received — needs receiving action
    supabase.from('shipments')
      .select('id, code, description, actual_delivery')
      .eq('status', 'delivered')
      .order('actual_delivery', { ascending: true })
      .limit(10),

    // Received but not yet inspected — check for missing inspections
    supabase.from('shipments')
      .select('id, code, description, actual_delivery')
      .eq('status', 'received')
      .order('actual_delivery', { ascending: true })
      .limit(10),

    // Low stock items (admin only)
    isAdmin
      ? supabase.from('inventory_balances')
          .select('component_id, quantity, component:components(code, name, low_stock_threshold, unit)')
          .gt('components.low_stock_threshold', 0)
          .limit(10)
      : { data: [] },

    // Recent activity
    supabase.from('activity_log')
      .select('id, entity_code, action, description, created_at, performer:profiles!performed_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Filter low stock manually since join filtering is tricky
  const actualLowStock = (lowStockItems ?? []).filter((item: { component: { low_stock_threshold: number } | null; quantity: number }) =>
    item.component && item.quantity < (item.component as { low_stock_threshold: number }).low_stock_threshold
  )

  const deliveredShipments = deliveredShipmentsRaw ?? []
  const receivedShipments = receivedShipmentsRaw ?? []

  // Received shipments that don't have a receipt yet
  let shipmentsNeedingInspection: typeof receivedShipments = []
  if (receivedShipments.length > 0) {
    const { data: existingReceipts } = await supabase
      .from('receipts')
      .select('shipment_id')
      .in('shipment_id', receivedShipments.map((s: { id: string }) => s.id))
    const receivedIds = new Set((existingReceipts ?? []).map((r: { shipment_id: string }) => r.shipment_id))
    shipmentsNeedingInspection = receivedShipments.filter((s: { id: string }) => !receivedIds.has(s.id))
  }

  const inTransitCount = (activeShipments ?? []).filter((s: { status: string }) =>
    !['delivered', 'created'].includes(s.status)
  ).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Good {getTimeOfDay()}, {profile.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Admin stat row */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Pending Requests"
            value={(pendingRequests ?? []).length}
            icon={<FileText className="w-4 h-4" />}
            href="/requests?status=submitted"
            urgent={(pendingRequests ?? []).length > 0}
          />
          <StatCard
            label="Active Orders"
            value={(activeOrders ?? []).length}
            icon={<ShoppingCart className="w-4 h-4" />}
            href="/orders"
          />
          <StatCard
            label="Shipments In Transit"
            value={inTransitCount}
            icon={<Truck className="w-4 h-4" />}
            href="/shipments"
          />
          <StatCard
            label="Low Stock Items"
            value={actualLowStock.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            href="/inventory?filter=low_stock"
            urgent={actualLowStock.length > 0}
          />
        </div>
      )}

      {/* Action reminders — always visible to admins */}
      {isAdmin && (deliveredShipments.length > 0 || shipmentsNeedingInspection.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Needs Receiving */}
          {deliveredShipments.length > 0 && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm">
                  <Bell className="w-4 h-4" />
                  {deliveredShipments.length === 1
                    ? '1 Shipment Needs Receiving'
                    : `${deliveredShipments.length} Shipments Need Receiving`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {deliveredShipments.map((s: { id: string; code: string; description: string | null; actual_delivery: string | null }) => (
                  <Link key={s.id} href={`/shipments/${s.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">{s.description ?? s.code}</span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Delivered {formatDate(s.actual_delivery)}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </Link>
                ))}
                <Link href="/shipments?status=delivered" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1 px-2">
                  View all delivered <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Needs Inspection */}
          {shipmentsNeedingInspection.length > 0 && (
            <Card className="border-purple-300 bg-purple-50 dark:bg-purple-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm">
                  <ClipboardCheck className="w-4 h-4" />
                  {shipmentsNeedingInspection.length === 1
                    ? '1 Shipment Awaiting Inspection'
                    : `${shipmentsNeedingInspection.length} Shipments Awaiting Inspection`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {shipmentsNeedingInspection.map((s: { id: string; code: string; description: string | null; actual_delivery: string | null }) => (
                  <Link key={s.id} href={`/shipments/${s.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">{s.description ?? s.code}</span>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Received — inspection pending</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  </Link>
                ))}
                <Link href="/shipments?status=received" className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-1 px-2">
                  View all received <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Admin: pending requests */}
          {isAdmin && (pendingRequests ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Requests Awaiting Review
                  </CardTitle>
                  <Link href="/requests?status=submitted" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(pendingRequests ?? []).map((req: { id: string; code: string; status: string; purpose: string | null; created_at: string; requester: { full_name: string } | null }) => (
                    <Link
                      key={req.id}
                      href={`/requests/${req.id}`}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[var(--muted-foreground)] w-20 shrink-0">{req.code}</span>
                        <div>
                          <p className="text-sm font-medium">{req.purpose ?? 'No description'}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">by {(req.requester as { full_name: string } | null)?.full_name} · {formatRelative(req.created_at)}</p>
                        </div>
                      </div>
                      <Badge className={requestStatusClass(req.status as never)}>{REQUEST_STATUS_LABELS[req.status as never]}</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* My requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  {isAdmin ? 'Recent Requests' : 'My Requests'}
                </CardTitle>
                <Link href="/requests" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(myRequests ?? []).length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-[var(--muted-foreground)]">No requests yet.</p>
                  <Link href="/requests/new" className="text-xs text-[var(--primary)] hover:underline mt-2 inline-block">
                    Create your first request →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {(myRequests ?? []).map((req: { id: string; code: string; status: string; purpose: string | null; updated_at: string }) => (
                    <Link
                      key={req.id}
                      href={`/requests/${req.id}`}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[var(--muted-foreground)] w-20 shrink-0">{req.code}</span>
                        <div>
                          <p className="text-sm">{req.purpose ?? 'No description'}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">Updated {formatRelative(req.updated_at)}</p>
                        </div>
                      </div>
                      <Badge className={requestStatusClass(req.status as never)}>{REQUEST_STATUS_LABELS[req.status as never]}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Shipments (excluding complete/received) */}
          {(activeShipments ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    Shipments in Progress
                  </CardTitle>
                  <Link href="/shipments" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(activeShipments ?? []).map((s: { id: string; code: string; description: string | null; status: string; has_exception: boolean; expected_delivery: string | null }) => (
                    <Link
                      key={s.id}
                      href={`/shipments/${s.id}`}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[var(--muted-foreground)] w-20 shrink-0">{s.code}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            {s.has_exception && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                            <p className="text-sm">{s.description ?? s.code}</p>
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)]">Expected {formatDate(s.expected_delivery)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className={shipmentStatusClass(s.status as never)}>{SHIPMENT_STATUS_LABELS[s.status as never] ?? s.status}</Badge>
                        {s.has_exception && <span className="text-xs text-amber-600 font-medium">!</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: activity + low stock */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(recentActivity ?? []).length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {(recentActivity ?? []).map((event: { id: string; entity_code: string | null; action: string; description: string; created_at: string; performer: { full_name: string } | null }) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs leading-snug">{event.description}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{formatRelative(event.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low stock alert (admin) */}
          {isAdmin && actualLowStock.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {actualLowStock.map((item: { component_id: string; quantity: number; component: { code: string; name: string; low_stock_threshold: number; unit: string } | null }) => (
                    <Link
                      key={item.component_id}
                      href={`/components/${item.component_id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-amber-50 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-medium">{item.component?.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{item.component?.code}</p>
                      </div>
                      <p className="text-xs font-bold text-amber-600">
                        {item.quantity} / {item.component?.low_stock_threshold} {item.component?.unit}
                      </p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All clear state */}
          {isAdmin && deliveredShipments.length === 0 && shipmentsNeedingInspection.length === 0 && actualLowStock.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center">
                <Package className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-[var(--muted-foreground)]">Everything is up to date.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, href, urgent }: {
  label: string; value: number; icon: React.ReactNode; href: string; urgent?: boolean
}) {
  return (
    <Link href={href}>
      <div className={`card p-4 hover:shadow-sm transition-shadow ${urgent && value > 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`${urgent && value > 0 ? 'text-amber-500' : 'text-[var(--muted-foreground)]'}`}>{icon}</span>
          <span className={`text-2xl font-bold ${urgent && value > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--foreground)]'}`}>{value}</span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      </div>
    </Link>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
