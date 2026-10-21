import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { Plus, FlaskConical } from 'lucide-react'
import { formatDate } from '@/lib/utils'
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
  approved_to_build: 'badge-draft',
  manufacturing: 'badge-under-review',
  in_test: 'badge-under-review',
  failure_analysis: 'badge-cancelled',
  passed: 'badge-approved',
  retired: 'badge-ordered',
  scrapped: 'badge-cancelled',
}

export default async function SamplesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  const { data: samples } = await supabase
    .from('samples')
    .select(`
      id, code, variant_serial, status, manufacture_date, notes,
      variant:product_variants(id, name, product:products(name))
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Samples</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{(samples ?? []).length} sample{(samples ?? []).length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <Link href="/samples/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Register Sample</Button>
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Manufactured</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(samples ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={<FlaskConical className="w-8 h-8 text-[var(--muted-foreground)]" />}
                    title="No samples yet"
                    description={isAdmin ? 'Register your first manufactured sample.' : 'No samples have been registered yet.'}
                    action={isAdmin ? <Link href="/samples/new"><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Register Sample</Button></Link> : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (samples ?? []).map((s: {
                id: string; code: string; variant_serial: number; status: string;
                manufacture_date: string | null; notes: string | null;
                variant: { id: string; name: string; product: { name: string } | null } | null
              }) => {
                const displayName = s.variant
                  ? `${s.variant.name} #${String(s.variant_serial).padStart(3, '0')}`
                  : s.code
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">{s.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/samples/${s.id}`} className="hover:text-[var(--primary)]">{displayName}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {s.variant?.product?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_CLASS[s.status] ?? 'badge-draft'} text-xs`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {formatDate(s.manufacture_date)}
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
