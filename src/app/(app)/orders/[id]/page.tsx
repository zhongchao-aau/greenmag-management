import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Pencil, ShoppingCart } from 'lucide-react'
import { orderStatusClass, ORDER_STATUS_LABELS, formatDate, formatRelative, formatQuantity, formatCurrency } from '@/lib/utils'
import { OrderActions } from './order-actions'
export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  const { data: order } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(id, name, contact_name, contact_email)
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  // Items: admin sees cost, user sees order_items_public view
  const itemsView = isAdmin ? 'order_items' : 'order_items_public'
  const { data: items } = await supabase
    .from(itemsView)
    .select(isAdmin
      ? 'id, quantity, unit_price, currency, total_cost, notes, component:components(id, code, name, unit, supplier_id, suppliers(name))'
      : 'id, quantity, notes, component:components(id, code, name, unit, supplier_id, suppliers(name))'
    )
    .eq('order_id', id)

  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, code, status, expected_delivery')
    .eq('order_id', id)

  const { data: activity } = await supabase
    .from('activity_log')
    .select('id, description, created_at, performer:profiles!performed_by(full_name)')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })

  const canTransition = isAdmin

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
                  {order.notes && (
                    <p className="text-base font-semibold text-[var(--foreground)] mt-1 mb-1">{order.notes}</p>
                  )}
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
                {isAdmin && (
                  <Link href={`/orders/${id}/edit`}>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                )}
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

          {/* Items table */}
          <Card>
            <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Quantity</TableHead>
                    {isAdmin && <TableHead>Unit Price</TableHead>}
                    {isAdmin && <TableHead>Total</TableHead>}
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((item: {
                    id: string; quantity: number;
                    unit_price?: number | null; currency?: string | null; total_cost?: number | null;
                    notes: string | null; component: { id: string; code: string; name: string; unit: string; supplier_id?: string | null; suppliers?: { name: string } | null } | null
                  }) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.component ? (
                          <div>
                            <Link href={`/components/${item.component.id}`} className="text-sm font-medium hover:text-[var(--primary)]">
                              {item.component.name}
                            </Link>
                            <p className="text-xs font-mono text-[var(--muted-foreground)]">{item.component.code}</p>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--muted-foreground)]">
                        {item.component?.suppliers?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatQuantity(item.quantity, item.component?.unit ?? 'pcs')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-sm">
                          {item.unit_price ? formatCurrency(item.unit_price, item.currency ?? 'EUR') : '—'}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-sm font-medium">
                          {item.total_cost ? formatCurrency(item.total_cost, item.currency ?? 'EUR') : '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-[var(--muted-foreground)]">{item.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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
                        <Badge className="badge-draft">{s.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status History */}
          {(activity ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
              <CardContent>
                <div>
                  {(activity ?? []).map((event: { id: string; description: string; created_at: string; performer: { full_name: string } | null }, idx: number, arr: unknown[]) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                        {idx < arr.length - 1 && <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {(event.performer as { full_name: string } | null)?.full_name ?? 'System'} · {formatRelative(event.created_at)}
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

          {isAdmin && (shipments ?? []).length === 0 && ['sent', 'confirmed'].includes(order.status) && (
            <Card>
              <CardContent className="pt-4">
                <Link href={`/shipments/new?order=${id}`} className="block">
                  <button className="w-full text-sm text-[var(--primary)] hover:underline text-left">+ Create Shipment for this Order</button>
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
              {order.supplier_ref && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">Notes</p>
                  <p className="text-sm">{order.supplier_ref}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
