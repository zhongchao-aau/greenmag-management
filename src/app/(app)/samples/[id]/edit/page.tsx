'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const STATUSES = [
  { value: 'manufactured', label: 'Manufactured' },
  { value: 'in_test', label: 'In Test' },
  { value: 'passed', label: 'Passed' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'failed', label: 'Failed' },
  { value: 'scrapped', label: 'Scrapped' },
]

export default function SampleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    status: '',
    notes: '',
    manufacture_date: '',
  })

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      const supabase = createClient()
      Promise.all([
        supabase.from('profiles').select('role').single(),
        supabase.from('samples').select('*').eq('id', p.id).single(),
      ]).then(([{ data: profile }, { data: sample }]) => {
        if (profile?.role !== 'admin') {
          router.replace(`/samples/${p.id}`)
          return
        }
        if (!sample) { router.replace('/samples'); return }
        const s = sample as any
        setForm({
          status: s.status ?? 'manufactured',
          notes: s.notes ?? '',
          manufacture_date: s.manufacture_date ?? '',
        })
        setLoading(false)
      })
    })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('samples')
      .update({
        status: form.status,
        notes: form.notes.trim() || null,
        manufacture_date: form.manufacture_date || null,
      })
      .eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/samples/${id}`)
    router.refresh()
  }

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading…</div>

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href={`/samples/${id}`} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Sample
      </Link>
      <Card>
        <CardHeader><CardTitle>Edit Sample</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Manufacture Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.manufacture_date}
                onChange={e => set('manufacture_date', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Optional notes or observations"
              />
            </div>

            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
              <Link href={`/samples/${id}`}><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
