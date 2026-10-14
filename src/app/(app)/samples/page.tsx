import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  approved_to_build: 'Approved to Build',
  manufacturing: 'Manufacturing',
  in_test: 'In Test',
  failure_analysis: 'Failure Analysis',
  passed: 'Passed',
  retired: 'Retired',
  scrapped: 'Scrapped',
}

const STATUS_CLASS: Record<string, string> = {
  approved_to_build: 'badge-pending',
  manufacturing: 'badge-pending',
  in_test: 'badge-pending',
  failure_analysis: 'badge-cancelled',
  passed: 'badge-approved',
  retired: 'badge-cancelled',
  scrapped: 'badge-cancelled',
}

const ACTIVE_STATUSES = ['approved_to_build', 'manufacturing']
const TESTING_STATUSES = ['in_test', 'failure_analysis']
const COMPLETE_STATUSES = ['passed', 'retired', 'scrapped']

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'testing', label: 'Testing' },
  { value: 'complete', label: 'Complete' },
]

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('samples')
    .select('id, code, name, status, product_id, variant_id, products(name), product_variants(code, name)')
    .order('created_at', { ascending: false })

  if (tab === 'active') {
    query = query.in('status', ACTIVE_STATUSES)
  } else if (tab === 'testing') {
    query = query.in('status', TESTING_STATUSES)
  } else if (tab === 'complete') {
    query = query.in('status', COMPLETE_STATUSES)
  }

  const { data: samples } = await query

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Samples</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{(samples ?? []).length} samples</p>
        </div>
        <Link href="/samples/new">
          <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Sample</Button>
        </Link>
      </div>

      <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
        {STATUS_TABS.map(t => (
          <Link
            key={t.value}
            href={t.value ? `/samples?tab=${t.value}` : '/samples'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.value
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Product / Variant</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(samples ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState
                    icon={<FlaskConical className="w-8 h-8 text-[var(--muted-foreground)]" />}
                    title="No samples found"
                    description="Create a new sample to get started."
                    action={<Link href="/samples/new"><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Sample</Button></Link>}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (samples ?? []).map((sample: {
                id: string; code: string; name: string; status: string;
                product_id: string | null; variant_id: string | null;
                products: { name: string } | null;
                product_variants: { code: string; name: string } | null;
              }) => {
                const product = sample.products
                const variant = sample.product_variants
                return (
                  <TableRow key={sample.id}>
                    <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">{sample.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/samples/${sample.id}`} className="hover:text-[var(--primary)]">{sample.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {product?.name ?? '—'}
                      {variant && <span className="block text-xs">{variant.code} — {variant.name}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASS[sample.status] ?? 'badge-pending'}>
                        {STATUS_LABELS[sample.status] ?? sample.status}
                      </Badge>
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
