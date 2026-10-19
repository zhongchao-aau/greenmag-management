'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, FlaskConical } from 'lucide-react'

export default function EditSamplePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sampleCode, setSampleCode] = useState('')
  const [form, setForm] = useState({
    manufacture_date: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: s } = await supabase
        .from('samples')
        .select('code, manufacture_date, notes')
        .eq('id', id)
        .single()
      if (s) {
        setSampleCode(s.code ?? '')
        setForm({
          manufacture_date: s.manufacture_date ? s.manufacture_date.slice(0, 10) : '',
          notes: s.notes ?? '',
        })
      }
      setLoadingData(false)
    }
    load()
  }, [id])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('samples').update({
      manufacture_date: form.manufacture_date || null,
      notes: form.notes || null,
    }).eq('id', id)
    if (error) { setError(error.message); setSaving(false); return }
    router.push(`/samples/${id}`)
    router.refresh()
  }

  if (loadingData) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href={`/samples/${id}`} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Sample
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-500 shrink-0" />
            <div>
              <CardTitle>Edit Sample</CardTitle>
              {sampleCode && <p className="text-sm text-[var(--muted-foreground)] font-mono mt-0.5">{sampleCode}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Optional notes about this sample..."
              />
            </div>
            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving}>Save Changes</Button>
              <Link href={`/samples/${id}`}><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
