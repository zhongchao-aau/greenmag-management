import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

const STATUS_CLASS: Record<string, string> = {
  approved_to_build: 'badge-pending',
  manufacturing: 'badge-pending',
  in_test: 'badge-pending',
  failure_analysis: 'badge-cancelled',
  passed: 'badge-approved',
  retired: 'badge-cancelled',
  scrapped: 'badge-cancelled',
}

const STATUS_DOTS: Record<string, string> = {
  approved_to_build: 'bg-[var(--primary)]',
  manufacturing: 'bg-blue-500',
  in_test: 'bg-yellow-500',
  failure_analysis: 'bg-orange-500',
  passed: 'bg-green-500',
  retired: 'bg-[var(--muted-foreground)]',
  scrapped: 'bg-[var(--muted-foreground)]',
}

interface HistoryEntry {
  id: string
  status: string
  changed_at: string
  changed_by: string | null
  notes: string | null
}

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: sample, error }, { data: history }] = await Promise.all([
    supabase
      .from('samples')
      .select('*, products(id, name, code), product_variants(id, code, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('sample_status_history')
      .select('id, status, changed_at, changed_by, notes')
      .eq('sample_id', id)
      .order('changed_at', { ascending: false }),
  ])

  if (error || !sample) notFound()

  const product = sample.products as { id: string; name: string; code: string } | null
  const variant = (sample as any).product_variants as { id: string; code: string; name: string } | null
  const statusLabel = STATUS_LABELS[sample.status] ?? sample.status
  const statusClass = STATUS_CLASS[sample.status] ?? 'badge-pending'
  const historyEntries: HistoryEntry[] = (history ?? []) as HistoryEntry[]

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <Link href="/samples" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Samples
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold">{sample.name}</h1>
            <Badge className={statusClass}>{statusLabel}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-[var(--muted-foreground)] font-mono">{sample.code}</span>
            {product && (
              <span className="text-sm text-[var(--muted-foreground)]">
                <Link href={`/products/${product.id}`} className="hover:text-[var(--primary)]">
                  {product.name}
                </Link>
                {variant && (
                  <span> / {variant.code} — {variant.name}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/samples/${id}/edit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
        >
          <Edit className="w-3.5 h-3.5" />Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Build Objective */}
          {(sample as any).build_objective && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold mb-3">Build Objective</h2>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
                {(sample as any).build_objective}
              </p>
            </div>
          )}

          {/* Notes */}
          {sample.notes && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold mb-3">Notes</h2>
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">{sample.notes}</p>
            </div>
          )}

          {/* Update Status */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold mb-4">Update Status</h2>
            <SampleActions sampleId={id} currentStatus={sample.status} />
          </div>

          {/* Status History */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold mb-4">Status History</h2>
            {historyEntries.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] italic">No history recorded yet.</p>
            ) : (
              <ol className="relative border-l border-[var(--border)] space-y-0">
                {historyEntries.map((entry, idx) => {
                  const label = STATUS_LABELS[entry.status] ?? entry.status
                  const cls = STATUS_CLASS[entry.status] ?? 'badge-pending'
                  const dot = STATUS_DOTS[entry.status] ?? 'bg-[var(--muted-foreground)]'
                  return (
                    <li key={entry.id} className={`ml-4 ${idx < historyEntries.length - 1 ? 'pb-6' : ''}`}>
                      <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-[var(--card)] ${dot}`} />
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <Badge className={cls}>{label}</Badge>
                        <span className="text-xs text-[var(--muted-foreground)] shrink-0">{formatDateTime(entry.changed_at)}</span>
                      </div>
                      {entry.changed_by && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{entry.changed_by}</p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-[var(--foreground)] mt-1">{entry.notes}</p>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Status</dt>
                <dd className="mt-0.5">
                  <Badge className={statusClass}>{statusLabel}</Badge>
                </dd>
              </div>
              {product && (
                <div>
                  <dt className="text-xs text-[var(--muted-foreground)]">Product</dt>
                  <dd className="text-sm mt-0.5">
                    <Link href={`/products/${product.id}`} className="hover:text-[var(--primary)]">
                      {product.name}
                    </Link>
                  </dd>
                </div>
              )}
              {variant && (
                <div>
                  <dt className="text-xs text-[var(--muted-foreground)]">Variant</dt>
                  <dd className="text-sm text-[var(--foreground)] mt-0.5">{variant.code} — {variant.name}</dd>
                </div>
              )}
              {(sample as any).location && (
                <div>
                  <dt className="text-xs text-[var(--muted-foreground)]">Location</dt>
                  <dd className="text-sm text-[var(--foreground)] mt-0.5">{(sample as any).location}</dd>
                </div>
              )}
              {sample.manufacture_date && (
                <div>
                  <dt className="text-xs text-[var(--muted-foreground)]">Manufactured</dt>
                  <dd className="text-sm text-[var(--foreground)] mt-0.5">{new Date(sample.manufacture_date).toLocaleDateString()}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Created</dt>
                <dd className="text-sm text-[var(--foreground)] mt-0.5">
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
