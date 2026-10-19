'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewSamplePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [variants, setVariants] = useState<{ id: string; name: string; product_name: string }[]>([])
  const [form, setForm] = useState({
    variant_id: '',
    manufacture_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('product_variants')
        .select('id, name, product:products(name)')
        .order('name', { ascending: true })
      if (data) {
        setVariants(data.map((v: { id: string; name: string; product: { name: string } | null }) => ({
          id: v.id,
          name: v.name,
          product_name: v.product?.name ?? '',
        })))
      }
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
    setLoading(true)
    const supabase = createClient()

    // Get next serial for this variant
    const { count } = await supabase
      .from('samples')
      .select('id', { count: 'exact', head: true })
      .eq('variant_id', form.variant_id)
    const nextSerial = (count ?? 0) + 1

    const { data, error: insertError } = await supabase
      .from('samples')
      .insert({
        variant_id: form.variant_id,
        variant_serial: nextSerial,
        status: 'approved_to_build',
        manufacture_date: form.manufacture_date || null,
        notes: form.notes || null,
      })
      .select('id')
      .single()

    if (insertError) { setError(insertError.message); setLoading(false); return }
    router.push(`/samples/${data.id}`)
    router.refresh()
  }

  const selectedVariant = variants.find(v => v.id === form.variant_id)
  const previewSerial = selectedVariant
    ? `${selectedVariant.name} #???` // will be assigned on save
    : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/samples" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Samples
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Register Sample</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">An MMGA-SMP code will be assigned automatically.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Product Variant <span className="text-[var(--destructive)]">*</span></label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.variant_id}
                onChange={e => set('variant_id', e.target.value)}
                required
              >
                <option value="">â Select a variant â</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.product_name ? `${v.product_name} Â· ` : ''}{v.name}
                  </option>
                ))}
              </select>
              {selectedVariant && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Sample will be named: <span className="font-medium text-[var(--foreground)]">{selectedVariant.name} #NNN</span> (serial assigned on save)
                </p>
              )}
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
                placeholder="Build notes, configuration details, deviations from nominal, etc."
              />
            </div>

            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Register Sample</Button>
              <Link href="/samples"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
