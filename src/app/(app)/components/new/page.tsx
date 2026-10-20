'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const COMPONENT_TYPES = [
  { value: 'raw_material', label: 'Raw Material (RM)' },
  { value: 'equipment',    label: 'Lab Equipment (EQ)' },
  { value: 'consumable',   label: 'Consumable / Supply (CS)' },
]
const BACK_LABELS: Record<string, string> = {
  raw_material: 'Materials',
  equipment:    'Equipment',
  consumable:   'Consumables',
}
const UNITS = ['pcs', 'kg', 'g', 'mg', 'L', 'mL', 'm', 'cm', 'mm', 'set', 'roll', 'sheet', 'box', 'pair']

export default function NewComponentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type') ?? 'raw_material'

  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', unit: 'pcs', supplier_id: '',
    manufacturer_part_number: '', low_stock_threshold: '', notes: '',
    component_type: typeParam,
    initial_quantity: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { router.push('/dashboard'); return }
      setUserId(user.id)
      const { data } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name')
      setSuppliers(data ?? [])
    }
    load()
  }, [router])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { data: comp, error: insertError } = await supabase.from('components').insert({
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      supplier_id: form.supplier_id || null,
      manufacturer_part_number: form.manufacturer_part_number || null,
      low_stock_threshold: form.low_stock_threshold ? parseFloat(form.low_stock_threshold) : null,
      notes: form.notes || null,
      component_type: form.component_type,
      is_active: true,
    }).select('id').single()
    if (insertError) { setError(insertError.message); setLoading(false); return }

    // Record opening stock if provided
    if (form.initial_quantity && parseFloat(form.initial_quantity) > 0 && comp) {
      const { error: txErr } = await supabase.from('inventory_transactions').insert({
        component_id: comp.id,
        tx_type: 'adjustment',
        quantity: parseFloat(form.initial_quantity),
        direction: 1,
        reason: 'Opening balance on component creation',
        performed_by: userId,
      })
      if (txErr) { setError('Component created but failed to set initial quantity: ' + txErr.message); setLoading(false); return }
    }

    router.push(`/components?type=${form.component_type}`)
    router.refresh()
  }

  const backHref = `/components?type=${typeParam}`
  const backLabel = BACK_LABELS[typeParam] ?? 'Components'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to {backLabel}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add New Component</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">A GM-CMP code will be assigned automatically.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Component Type <span className="text-[var(--destructive)]">*</span></label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.component_type}
                onChange={e => set('component_type', e.target.value)}
                required
              >
                {COMPONENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Input
              label="Component Name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="e.g. N52 Neodymium Magnet Block 10x5x3mm"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Detailed specification, dimensions, grade, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Unit <span className="text-[var(--destructive)]">*</span></label>
                <select
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  required
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <Input
                label="Manufacturer Part Number"
                value={form.manufacturer_part_number}
                onChange={e => set('manufacturer_part_number', e.target.value)}
                placeholder="e.g. BLK-10x5x3-N52"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Supplier</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.supplier_id}
                onChange={e => set('supplier_id', e.target.value)}
              >
                <option value="">— No supplier selected —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Can be set later once supplier is confirmed.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Initial Quantity"
                type="number"
                min="0"
                step="0.01"
                value={form.initial_quantity}
                onChange={e => set('initial_quantity', e.target.value)}
                placeholder="0"
                hint="Opening stock on hand. Leave blank for 0."
              />
              <Input
                label="Low Stock Threshold"
                type="number"
                min="0"
                step="0.01"
                value={form.low_stock_threshold}
                onChange={e => set('low_stock_threshold', e.target.value)}
                placeholder="e.g. 50"
                hint="Alert when inventory falls below this."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Storage requirements, handling notes, etc."
              />
            </div>
            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Add Component</Button>
              <Link href={backHref}><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
