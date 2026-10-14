import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
export const dynamic = 'force-dynamic'

export default async function ReceivingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'
  if (!isAdmin) redirect('/dashboard')

  const { data: receipts } = await supabase
    .from('receipts')
    .select(`
      id, received_at, notes, created_at,
      shipment:shipments(id, code),
      inspections(id, overall_result),
      receipt_items(id)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const allReceipts = receipts ?? []

  // Compute stats
  const inspected = allReceipts.filter(r => r.inspections?.length > 0)
  const passCount = inspected.filter(r => r.inspections[0]?.overall_result === 'pass').length
  const failCount = inspected.filter(r => r.inspections[0]?.overall_result === 'fail').length
  const passRate = inspected.length > 0 ? Math.round((passCount / inspected.length) * 100) : null

  function resultBadge(result: string) {
    if (result === 'pass') return <Badge className="badge-approved text-xs">Pass</Badge>
    if (result === 'fail') return <Badge className="badge-cancelled text-xs">Fail</Badge>
    return <Badge className="badge-under-review text-xs">Partial</Badge>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Receiving &amp; Inspections</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{allReceipts.length} receipts</p>
        </div>
        <Link href="/receiving/new">
          <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Record Receipt</Button>
        </Link>
      </div>

      {/* Stats summary */}
      {allReceipts.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-2xl font-bold">{allReceipts.length}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Total Receipts</p>
          </div>
          <div className="card p-4 border-green-200 bg-green-50 dark:bg-green-950/20">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{passCount}</p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Passed</p>
          </div>
          <div className="card p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{failCount}</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Failed</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold">{passRate !== null ? `${passRate}%` : '—'}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Pass Rate</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shipment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Inspection</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allReceipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="No receipts yet"
                    description="Record a receipt when you receive and inspect a shipment."
                  />
                </TableCell>
              </TableRow>
            ) : (
              allReceipts.map((r: {
                id: string
                received_at: string
                notes: string | null
                shipment: { id: string; code: string } | null
                inspections: { id: string; overall_result: string }[]
                receipt_items: { id: string }[]
              }) => {
                const insp = r.inspections?.[0]
                const itemCount = r.receipt_items?.length ?? 0
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.received_at)}</TableCell>
                    <TableCell>
                      {r.shipment ? (
                        <Link href={`/shipments/${r.shipment.id}`} className="text-sm font-mono hover:text-[var(--primary)]">
                          {r.shipment.code}
                        </Link>
                      ) : <span className="text-sm text-[var(--muted-foreground)]">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : '—'}
                    </TableCell>
                    <TableCell>{insp ? resultBadge(insp.overall_result) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}</TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)] max-w-xs truncate">{r.notes ?? '—'}</TableCell>
                    <TableCell>
                      <Link href={`/receiving/${r.id}`} className="text-xs text-[var(--primary)] hover:underline">View</Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
