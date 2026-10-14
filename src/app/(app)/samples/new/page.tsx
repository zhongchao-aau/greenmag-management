'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LocationSelect } from '@/components/ui/location-select'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Variant {
  id: string
  code: string
  name: string
  products: { name: string } | null
}

export default function NewSamplePage() {
  const router = useRouter()
  const [variants, setVariants] = useState<Variant[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    variant_id: '',
    manufacture_date: new Date().toISOString().slice(0, 10),
    location: 'dk_aalborg',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('product_variants')
        .select('id, code, name, products(name)')
        .eq('status', 'active')
        .order('name')
      setVariants((data as any) ?? [])
    }
    load()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.variant_id) { setError('Please select a variant.'); return }
    setError('')
    setSaving(true)
    const supabase = createClient()

    const { count } = await supabase
      .from('samples')
      .select('*', { count: 'exact', head: true })
      .eq('variant_id', form.variant_id)

    const variant_serial = (count ?? 0) + 1

    const { data, error: err } = await supabase
      .from('samples')
      .insert({
        variant_id: form.variant_id,
        variant_serial,
        status: 'manufactured',
        manufacture_date: form.manufacture_date,
        location: form.location || 'dk_aalborg',
        notes: form.notes || null,
      })
      .select('id')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/samples/${data.id}`)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/samples" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Samples
      </Link>
      <Card>
        <CardHeader><CardTitle>Register Sample</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Product Variant <span className="text-[var(--destructive)]">*</span>
              </label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.variant_id}
                onChange={e => set('variant_id', e.target.value)}
                required
              >
                <option value="">Select variant…</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.products ? ` — ${v.products.name}` : ''}
                  </option>
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
              <label className="block text-sm font-medium mb-1.5">Current Location</label>
              <LocationSelect
                id="location"
                value={form.location}
                onChange={v => set('location', v)}
                placeholder="Select location"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Registering…' : 'Register Sample'}</Button>
              <Link href="/samples"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
