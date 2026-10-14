import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  approved_to_build: 'Approved to Build',
  manufacturing: 'Manufacturing',
  in_test: 'In Test',
  failure_analysis: 'Failure Analysis',
  passed: 'Passed',
  retired: 'Retired',
  scrapped: 'Scrapped',
}

const STATUS_COLORS: Record<string, string> = {
  approved_to_build: 'bg-indigo-100 text-indigo-800',
  manufacturing: 'bg-blue-100 text-blue-800',
  in_test: 'bg-yellow-100 text-yellow-800',
  failure_analysis: 'bg-orange-100 text-orange-800',
  passed: 'bg-green-100 text-green-800',
  retired: 'bg-gray-100 text-gray-600',
  scrapped: 'bg-gray-100 text-gray-500',
}

const ACTIVE_STATUSES = ['approved_to_build', 'manufacturing']
const TESTING_STATUSES = ['in_test', 'failure_analysis']
const COMPLETE_STATUSES = ['passed', 'retired', 'scrapped']

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ?? 'all'

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

  const { data: samples, error } = await query

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'testing', label: 'Testing' },
    { key: 'complete', label: 'Complete' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Samples</h1>
          <p className="text-sm text-gray-500 mt-1">Track build samples through their lifecycle</p>
        </div>
        <Link
          href="/samples/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Sample
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/samples?tab=${t.key}`}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-700 text-sm">
          Error loading samples: {error.message}
        </div>
      )}

      {!samples || samples.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔬</div>
          <p className="text-gray-500 text-lg">No samples found</p>
          <p className="text-gray-400 text-sm mt-1">Create a new sample to get started</p>
          <Link
            href="/samples/new"
            className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Create Sample
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sample
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product / Variant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {samples.map((sample) => {
                const product = sample.products as { name: string } | null
                const variant = sample.product_variants as { code: string; name: string } | null
                const label = STATUS_LABELS[sample.status] ?? sample.status
                const color = STATUS_COLORS[sample.status] ?? 'bg-gray-100 text-gray-600'
                return (
                  <tr key={sample.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/samples/${sample.id}`} className="group">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {sample.name}
                        </div>
                        <div className="text-xs text-gray-400">{sample.code}</div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">{product?.name ?? '—'}</div>
                      {variant && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {variant.code} — {variant.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
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
