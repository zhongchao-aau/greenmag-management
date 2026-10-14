import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import { SampleActions } from './sample-actions'
import { LOCATION_LABELS } from '@/lib/locations'

const STATUS_LABELS: Record<string, string> = {
  approved_to_build: 'Approved to Build',
  manufactured: 'Manufactured',
  in_test: 'In Test',
  passed: 'Passed',
  deployed: 'Deployed',
  failed: 'Failed',
  scrapped: 'Scrapped',
}

const STATUS_COLORS: Record<string, string> = {
  approved_to_build: 'bg-indigo-100 text-indigo-800',
  manufactured: 'bg-blue-100 text-blue-800',
  in_test: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  deployed: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  scrapped: 'bg-gray-100 text-gray-700',
}

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: sample }, { data: profile }] = await Promise.all([
    supabase
      .from('samples')
      .select(`
        id, code, variant_serial, status, notes, manufacture_date, location,
        product_variants ( name, code, products ( name ) )
      `)
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('role').single(),
  ])

  if (!sample) notFound()

  const s = sample as any
  const variant = s.product_variants as any
  const product = variant?.products as any
  const displayName = `${variant?.name ?? 'Sample'} #${String(s.variant_serial ?? 1).padStart(3, '0')}`
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/samples" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Samples
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-mono text-[var(--muted-foreground)] mb-1">{s.code}</p>
              <CardTitle>{displayName}</CardTitle>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--muted-foreground)] text-xs mb-0.5">Product</p>
              <p className="font-medium">{product?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)] text-xs mb-0.5">Variant</p>
              <p className="font-medium">{variant?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)] text-xs mb-0.5">Manufactured</p>
              <p>{s.manufacture_date ? new Date(s.manufacture_date).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)] text-xs mb-0.5">Location</p>
              <p>{s.location ? (LOCATION_LABELS[s.location] ?? s.location) : '—'}</p>
            </div>
          </div>

          {s.notes && (
            <div className="text-sm">
              <p className="text-[var(--muted-foreground)] text-xs mb-0.5">Notes</p>
              <p className="whitespace-pre-wrap">{s.notes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--muted-foreground)]">Status Transitions</p>
                <Link href={`/samples/${id}/edit`} className="text-xs text-[var(--primary)] hover:underline font-medium">
                  Edit Details
                </Link>
              </div>
              <SampleActions id={id} currentStatus={s.status} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
