import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  manufactured: 'Manufactured',
  in_test: 'In Test',
  passed: 'Passed',
  deployed: 'Deployed',
  failed: 'Failed',
  scrapped: 'Scrapped',
}

const STATUS_COLORS: Record<string, string> = {
  manufactured: 'bg-blue-100 text-blue-800',
  in_test: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  deployed: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  scrapped: 'bg-gray-100 text-gray-700',
}

export default async function SamplesPage() {
  const supabase = await createClient()
  const { data: samples } = await supabase
    .from('samples')
    .select(`
      id, code, variant_serial, status, manufacture_date,
      product_variants ( name, products ( name ) )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Samples</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage physical sample units</p>
        </div>
        <Link href="/samples/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Register Sample
          </Button>
        </Link>
      </div>

      {!samples || samples.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <p className="text-sm">No samples registered yet.</p>
          <Link href="/samples/new" className="mt-3 inline-block">
            <Button size="sm">Register First Sample</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted-foreground)]">Sample</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted-foreground)]">Product</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted-foreground)]">Manufactured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(samples as any[]).map(s => {
                const variant = s.product_variants
                const variantName = variant?.name ?? 'Unknown'
                const displayName = `${variantName} #${String(s.variant_serial ?? 1).padStart(3, '0')}`
                return (
                  <tr key={s.id} className="hover:bg-[var(--secondary)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/samples/${s.id}`} className="font-medium hover:text-[var(--primary)]">
                        {displayName}
                      </Link>
                      <p className="font-mono text-xs text-[var(--muted-foreground)] mt-0.5">{s.code}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {variant?.products?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {s.manufacture_date ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
