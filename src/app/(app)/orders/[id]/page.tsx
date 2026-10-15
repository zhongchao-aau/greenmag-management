import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import {
  orderStatusClass, ORDER_STATUS_LABELS,
  shipmentStatusClass, SHIPMENT_STATUS_LABELS,
  formatDate, formatRelative
} from '@/lib/utils'
import { OrderActions } from './order-actions'
import { EditOrderItems } from './edit-order-items'
export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(id, name, contact_name, contact_email),
      created_by_profile:profiles!created_by(full_name),
      request:purchase_requests(id, code, purpose)
    `)
    .eq('id', id)
    .maybeSingle()

  if (orderError || !order) notFound()

  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, code, status, expected_delivery')
    .eq('order_id', id)

  const { data: activity } = await supabase
    .from('activity_log')
    .select('id, description, created_at, performer:profiles!performed_by(full_name)')
    .eq('entity_id', id)
    .order('created_at', { ascending: true })

  const canTransition = isAdmin
  // Statuses where shipment creation makes sense (order placed but not yet fully received)
  const canCreateShipment = isAdmin && (shipments ?? []).length === 0 &&
    ['ordered', 'confirmed', 'partially_shipped', 'shipped'].includes(order.status)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/orders" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Orders
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <ShoppingCart className="w-5 h-5 text-indigo-500" />
                    <span className="font-mono text-sm text-[var(--muted-foreground)]">{order.code}</span>
                    <Badge className={orderStatusClass(order.status as never)}>{ORDER_STATUS_LABELS[order.status as never]}</Badge>
                  </div>
                  {order.supplier && (
                    <div>
                      <Link href={`/suppliers/${(order.supplier as { id: string; name: string }).id}`} className="font-semibold hover:text-[var(--primary)]">
                        {(order.supplier as { id: string; name: string }).name}
                      </Link>
                      {(order.supplier as { contact_name: string | null }).contact_name && (
                        <p className="text-sm text-[var(--muted-foreground)]">{(order.supplier as { contact_name: string | null }).contact_name}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {order.request && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  From request{' '}
                  <Link href={`/requests/${(order.request as { id: string; code: string }).id}`} className="text-[var(--primary)] hover:underline">
                    {(order.request as { id: string; code: string; purpose: string | null }).code}
                  </Link>
                  {(order.request as { purpose: string | null }).purpose && ` · ${(order.request as { purpose: string | null }).purpose}`}
                </p>
              )}
            </CardHeader>
          </Card>

          <EditOrderItems orderId={id} isAdmin={isAdmin} />

          {/* Linked shipments */}
          {(shipments ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Shipments</CardTitle>
                  {isAdmin && (
                    <Link href={`/shipments/new?order=${id}`} className="text-xs text-[var(--primary)] hover:underline">+ Add Shipment</Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(shipments ?? []).map((s: { id: string; code: string; status: string; expected_delivery: string | null }) => (
                    <Link key={s.id} href={`/shipments/${s.id}`}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--secondary)] transition-colors"
                    >
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">{s.code}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--muted-foreground)]">Expected {formatDate(s.expected_delivery)}</span>
                        <Badge className={shipmentStatusClass(s.status as never)}>
                          {SHIPMENT_STATUS_LABELS[s.status as never] ?? s.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity */}
          {(activity ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(activity ?? []).map((event: { id: string; description: string; created_at: string; performer: { full_name: string } | null }) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {(event.performer as { full_name: string } | null)?.full_name} · {formatRelative(event.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {canTransition && (
            <OrderActions orderId={id} status={order.status} />
          )}

          {canCreateShipment && (
            <Card>
              <CardContent className="pt-4">
                <Link
                  href={`/shipments/new?order=${id}`}
                  className="block w-full text-sm text-[var(--primary)] hover:underline text-left"
                >
                  + Create Shipment for this Order
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Created</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Expected</span>
                <span>{formatDate(order.expected_delivery)}</span>
              </div>
              {order.notes && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
              {order.supplier && (order.supplier as { contact_email: string | null }).contact_email && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">Supplier Contact</p>
                  <a
                    href={`mailto:${(order.supplier as { contact_email: string }).contact_email}`}
                    className="text-sm text-[var(--primary)] hover:underline"
                  >
                    {(order.supplier as { contact_email: string }).contact_email}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
