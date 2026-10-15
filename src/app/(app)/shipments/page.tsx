import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { AlertTriangle, Plus } from 'lucide-react'
import { shipmentStatusClass, SHIPMENT_STATUS_LABELS, formatDate } from '@/lib/utils'
import { RefreshAllTrackingButton } from './refresh-button'
export const dynamic = 'force-dynamic'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'china_dispatched', label: 'China Dispatched' },
  { value: 'cn_transit', label: 'CN Transit' },
  { value: 'customs', label: 'Customs' },
  { value: 'eu_transit', label: 'EU Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'received', label: 'Received' },
  { value: 'complete', label: 'Complete' },
]

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  const profile = profileData as { role: string } | null
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  let query = supabase
    .from('shipments')
    .select(`
      id, code, description, status, has_exception,
      expected_delivery, actual_delivery,
      china_carrier, eu_carrier,
      order:purchase_orders(code)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: shipments } = await query.limit(100)
  const activeStatus = status ?? ''

  // Fetch all linked orders from the join table for display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipmentIds = (shipments ?? []).map((s: any) => s.id as string)
  const shipmentOrderMap: Record<string, string[]> = {}
  if (shipmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: soRows } = await (supabase.from('shipment_order_links').select('shipment_id, order_id').in('shipment_id', shipmentIds) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOrderIds = [...new Set((soRows ?? []).map((r: any) => r.order_id as string))]
    if (allOrderIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: poRows } = await (supabase.from('purchase_orders').select('id, code').in('id', allOrderIds) as any)
      const codeById: Record<string, string> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(poRows ?? []).forEach((p: any) => { codeById[p.id] = p.code })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(soRows ?? []).forEach((r: any) => {
        if (!shipmentOrderMap[r.shipment_id]) shipmentOrderMap[r.shipment_id] = []
        const code = codeById[r.order_id]
        if (code && !shipmentOrderMap[r.shipment_id].includes(code)) shipmentOrderMap[r.shipment_id].push(code)
      })
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Shipments</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{(shipments ?? []).length} shipments</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <RefreshAllTrackingButton />}
          {isAdmin && (
            <Link href="/shipments/new">
              <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Shipment</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border)] overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.value}
            href={tab.value ? `/shipments?status=${tab.value}` : '/shipments'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeStatus === tab.value
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Carriers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(shipments ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title="No shipments"
                    description={isAdmin ? 'Create a shipment to track your incoming goods.' : 'No shipments yet.'}
                    action={isAdmin ? <Link href="/shipments/new"><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Shipment</Button></Link> : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (shipments ?? []).map((s: {
                id: string; code: string; description: string | null; status: string;
                has_exception: boolean;
                expected_delivery: string | null; actual_delivery: string | null;
                china_carrier: string | null; eu_carrier: string | null;
                order: { code: string } | null
              }) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">{s.code}</TableCell>
                  <TableCell>
                    <Link href={`/shipments/${s.id}`} className="text-sm font-medium hover:text-[var(--primary)] flex items-center gap-1.5">
                      {s.has_exception && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {s.description ?? s.code}
                    </Link>
                    {(() => {
                      const codes = shipmentOrderMap[s.id]
                      if (codes && codes.length > 0) return <p className="text-xs text-[var(--muted-foreground)]">{codes.join(' · ')}</p>
                      if (s.order) return <p className="text-xs text-[var(--muted-foreground)]">{s.order.code}</p>
                      return null
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge className={shipmentStatusClass(s.status as never)}>{SHIPMENT_STATUS_LABELS[s.status as never] ?? s.status}</Badge>
                      {s.has_exception && <span className="text-xs text-amber-600 font-medium">Exception</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(s.expected_delivery)}</TableCell>
                  <TableCell className="text-xs text-[var(--muted-foreground)]">
                    {[s.china_carrier, s.eu_carrier].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
