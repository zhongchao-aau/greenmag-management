import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, FlaskConical, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { SampleActions } from './sample-actions'
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
  manufacturing: 'badge-ordered',
  in_test: 'badge-under-review',
  failure_analysis: 'badge-cancelled',
  passed: 'badge-approved',
  retired: 'badge-draft',
  scrapped: 'badge-cancelled',
}

// Which transitions are allowed from each status
const TRANSITIONS: Record<string, { label: string; next: string; variant?: string }[]> = {
  approved_to_build: [
    { label: 'Start Manufacturing', next: 'manufacturing' },
    { label: 'Scrap', next: 'scrapped', variant: 'destructive' },
  ],
  manufacturing: [
    { label: 'Send to Test', next: 'in_test' },
    { label: 'Scrap', next: 'scrapped', variant: 'destructive' },
  ],
  in_test: [
    { label: 'Mark Passed', next: 'passed' },
    { label: 'Mark Failed', next: 'failure_analysis', variant: 'destructive' },
    { label: 'Back to Manufacturing', next: 'manufacturing' },
  ],
  failure_analysis: [
    { label: 'Retry Testing', next: 'in_test' },
    { label: 'Scrap', next: 'scrapped', variant: 'destructive' },
  ],
  passed: [
    { label: 'Retire', next: 'retired' },
    { label: 'Scrap', next: 'scrapped', variant: 'destructive' },
  ],
  retired: [
    { label: 'Scrap', next: 'scrapped', variant: 'destructive' },
  ],
  scrapped: [],
}

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const isAdmin = profile.role === 'admin'

  const { data: sample } = await supabase
    .from('samples')
    .select(`
      id, code, variant_serial, status, manufacture_date, notes, created_at,
      variant:product_variants(id, name, code, product:products(id, name))
    `)
    .eq('id', id)
    .single()

  if (!sample) notFound()

  const s = sample as {
    id: string; code: string; variant_serial: number; status: string;
    manufacture_date: string | null; notes: string | null; created_at: string;
    variant: { id: string; name: string; code: string; product: { id: string; name: string } | null } | null
  }

  const displayName = s.variant
    ? `${s.variant.name} #${String(s.variant_serial).padStart(3, '0')}`
    : s.code

  const transitions = TRANSITIONS[s.status] ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/samples" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Samples
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <FlaskConical className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-[var(--muted-foreground)]">{s.code}</span>
                    <Badge className={`${STATUS_CLASS[s.status] ?? 'badge-draft'} text-xs`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{displayName}</CardTitle>
                    {isAdmin && (
                      <Link href={`/samples/${id}/edit`} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0 border border-[var(--border)] rounded-md px-2 py-1 transition-colors">
                        <Pencil className="w-3 h-3" />Edit
                      </Link>
                    )}
                  </div>
                  {s.variant?.product && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">
                      <Link href={`/products/${s.variant.product.id}`} className="hover:text-[var(--primary)]">
                        {s.variant.product.name}
                      </Link>
                      {' Â· '}
                      <Link href={`/products/${s.variant.product.id}`} className="hover:text-[var(--primary)]">
                        {s.variant.name}
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {s.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{s.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {isAdmin && transitions.length > 0 && (
            <SampleActions sampleId={id} transitions={transitions} />
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Serial</span>
                <span className="font-mono">#{String(s.variant_serial).padStart(3, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Manufactured</span>
                <span>{formatDate(s.manufacture_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Registered</span>
                <span>{formatDate(s.created_at)}</span>
              </div>
              {s.variant && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Variant code</span>
                  <span className="font-mono text-xs">{s.variant.code}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
