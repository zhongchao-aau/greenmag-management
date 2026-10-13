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
  const [{ data: samples }, { data: profile }] = await Promise.all([
    supabase
      .from('samples')
      .select(`
        id, code, display_name, status, manufactured_at,
        product_variants ( name, products ( name ) )
      `)
      .order('manufactured_at', { ascending: false }),
    supabase.from('profiles').select('role').single(),
  ])
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Samples</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage physical sample units</p>
        </div>
        {isAdmin && (
          <Link href="/samples/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Register Sample
            </Button>
          </Link>
        )}
      </div>

      {!samples || samples.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <p className="text-sm">No samples registered yet.</p>
          {isAdmin && (
            <Link href="/samples/new">
              <Button variant="outline" className="mt-4">Register your first sample</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Code</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Display Name</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Variant / Product</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Manufactured</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s, i) => {
                const variant = s.product_variants as any
                const product = variant?.products as any
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--muted)]/30'}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/samples/${s.id}`} className="font-mono text-xs text-[var(--primary)] hover:underline">
                        {s.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.display_name}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {variant?.name ?? '—'}
                      {product?.name ? <span className="ml-1 text-xs">({product.name})</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {s.manufactured_at ? new Date(s.manufactured_at).toLocaleDateString() : '—'}
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
