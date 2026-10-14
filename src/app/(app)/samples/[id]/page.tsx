import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SampleActions from './sample-actions'

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

const ALL_STATUSES = [
  { value: 'approved_to_build', label: 'Approved to Build' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'in_test', label: 'In Test' },
  { value: 'failure_analysis', label: 'Failure Analysis' },
  { value: 'passed', label: 'Passed' },
  { value: 'retired', label: 'Retired' },
  { value: 'scrapped', label: 'Scrapped' },
]

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sample, error } = await supabase
    .from('samples')
    .select('*, products(id, name, code), product_variants(id, code, name)')
    .eq('id', id)
    .single()

  if (error || !sample) notFound()

  const product = sample.products as { id: string; name: string; code: string } | null
  const variant = (sample as any).product_variants as { id: string; code: string; name: string } | null
  const statusLabel = STATUS_LABELS[sample.status] ?? sample.status
  const statusColor = STATUS_COLORS[sample.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/samples" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Samples
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sample.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-400 font-mono">{sample.code}</span>
              {product && (
                <span className="text-sm text-gray-500">
                  <Link href={`/products/${product.id}`} className="text-indigo-600 hover:underline">
                    {product.name}
                  </Link>
                  {variant && (
                    <span className="text-gray-400"> / {variant.code} — {variant.name}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            <Link
              href={`/samples/${id}/edit`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Status Overview</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => {
            const isCurrent = s.value === sample.status
            const color = STATUS_COLORS[s.value] ?? 'bg-gray-100 text-gray-600'
            return (
              <span
                key={s.value}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  isCurrent
                    ? `${color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                }`}
              >
                {isCurrent && <span className="mr-1.5 text-xs">●</span>}
                {s.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Build Objective */}
          {(sample as any).build_objective && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Build Objective</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {(sample as any).build_objective}
              </p>
            </div>
          )}

          {/* Notes */}
          {sample.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{sample.notes}</p>
            </div>
          )}

          {/* Status Transitions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Update Status</h2>
            <SampleActions sampleId={id} currentStatus={sample.status} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                </dd>
              </div>
              {product && (
                <div>
                  <dt className="text-xs text-gray-500">Product</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    <Link href={`/products/${product.id}`} className="text-indigo-600 hover:underline">
                      {product.name}
                    </Link>
                  </dd>
                </div>
              )}
              {variant && (
                <div>
                  <dt className="text-xs text-gray-500">Variant</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{variant.code} — {variant.name}</dd>
                </div>
              )}
              {(sample as any).location && (
                <div>
                  <dt className="text-xs text-gray-500">Location</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{(sample as any).location}</dd>
                </div>
              )}
              {sample.manufacture_date && (
                <div>
                  <dt className="text-xs text-gray-500">Manufactured</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{new Date(sample.manufacture_date).toLocaleDateString()}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-800 mt-0.5">
                  {sample.created_at ? new Date(sample.created_at).toLocaleDateString() : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
