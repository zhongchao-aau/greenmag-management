import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export default async function ReceivingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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
        <Link
          href="/receiving/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          + Record Receipt
        </Link>
      </div>

      {/* Stats summary */}
      {allReceipts.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{allReceipts.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Receipts</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-700">{passCount}</p>
            <p className="text-xs text-green-600 mt-0.5">Passed</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-red-700">{failCount}</p>
            <p className="text-xs text-red-600 mt-0.5">Failed</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{passRate !== null ? `${passRate}%` : '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pass Rate</p>
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
