import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SampleActions from './sample-actions'

const STATUS_LABELS: Record<string, string> = {
  approved_to_build: 'Approved to Build',
  material_preparation: 'Material Preparation',
  manufacturing: 'Manufacturing',
  manufactured: 'Manufactured',
  in_test: 'In Test',
  post_test_analysis: 'Post-Test Analysis',
  passed: 'Passed',
  failed: 'Failed',
  deployed: 'Deployed',
  retired: 'Retired',
  scrapped: 'Scrapped',
}

const STATUS_COLORS: Record<string, string> = {
  approved_to_build: 'bg-indigo-100 text-indigo-800',
  material_preparation: 'bg-purple-100 text-purple-800',
  manufacturing: 'bg-blue-100 text-blue-800',
  manufactured: 'bg-cyan-100 text-cyan-800',
  in_test: 'bg-yellow-100 text-yellow-800',
  post_test_analysis: 'bg-orange-100 text-orange-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  deployed: 'bg-emerald-100 text-emerald-800',
  retired: 'bg-gray-100 text-gray-600',
  scrapped: 'bg-gray-100 text-gray-500',
}

const LIFECYCLE = [
  { status: 'approved_to_build', label: 'Approved' },
  { status: 'material_preparation', label: 'Materials' },
  { status: 'manufacturing', label: 'Manufacturing' },
  { status: 'manufactured', label: 'Manufactured' },
  { status: 'in_test', label: 'Testing' },
  { status: 'post_test_analysis', label: 'Analysis' },
  { status: 'passed', label: 'Passed' },
  { status: 'deployed', label: 'Deployed' },
]

const TERMINAL_STATUSES = ['failed', 'retired', 'scrapped']

function getLifecycleIndex(status: string) {
  return LIFECYCLE.findIndex(s => s.status === status)
}

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
  const currentIndex = getLifecycleIndex(sample.status)
  const isTerminal = TERMINAL_STATUSES.includes(sample.status)

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

      {/* Lifecycle Timeline */}
      {!isTerminal && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Lifecycle Progress</h2>
          <div className="flex items-center overflow-x-auto">
            {LIFECYCLE.map((stage, idx) => {
              const isDone = idx < currentIndex
              const isCurrent = idx === currentIndex
              return (
                <div key={stage.status} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isDone
                          ? 'bg-indigo-600 text-white'
                          : isCurrent
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs mt-1 whitespace-nowrap ${
                        isDone || isCurrent ? 'text-indigo-700 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {idx < LIFECYCLE.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${
                        idx < currentIndex ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isTerminal && (
        <div className={`rounded-lg border p-4 mb-6 flex items-center gap-3 ${
          sample.status === 'failed'
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <span className="text-2xl">
            {sample.status === 'failed' ? '❌' : sample.status === 'scrapped' ? '🗑️' : '📦'}
          </span>
          <div>
            <p className="font-medium text-gray-900">
              Final status: <strong>{statusLabel}</strong>
            </p>
            <p className="text-sm text-gray-500">No further lifecycle transitions are possible.</p>
          </div>
        </div>
      )}

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
              {(sample as any).material_date && (
                <div>
                  <dt className="text-xs text-gray-500">Material Ready</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{new Date((sample as any).material_date).toLocaleDateString()}</dd>
                </div>
              )}
              {(sample as any).manufacturing_date && (
                <div>
                  <dt className="text-xs text-gray-500">Manufacturing Start</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{new Date((sample as any).manufacturing_date).toLocaleDateString()}</dd>
                </div>
              )}
              {sample.manufacture_date && (
                <div>
                  <dt className="text-xs text-gray-500">Manufactured</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{new Date(sample.manufacture_date).toLocaleDateString()}</dd>
                </div>
              )}
              {(sample as any).test_date && (
                <div>
                  <dt className="text-xs text-gray-500">Test Date</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{new Date((sample as any).test_date).toLocaleDateString()}</dd>
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
