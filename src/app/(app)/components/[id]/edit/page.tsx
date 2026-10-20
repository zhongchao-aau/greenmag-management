'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, Minus } from 'lucide-react'

const UNITS = ['pcs', 'kg', 'g', 'mg', 'L', 'mL', 'm', 'cm', 'mm', 'set', 'roll', 'sheet', 'box', 'pair']
const COMPONENT_TYPES = [
  { value: 'raw_material', label: 'Raw Material (RM)' },
  { value: 'equipment', label: 'Lab Equipment (EQ)' },
  { value: 'consumable', label: 'Consumable / Supply (CS)' },
]

export default function EditComponentPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [currentStock, setCurrentStock] = useState<number>(0)
  const [userId, setUserId] = useState<string>('')
  const [form, setForm] = useState({
    name: '', description: '', unit: 'pcs', supplier_id: '',
    manufacturer_part_number: '', low_stock_threshold: '', notes: '', is_active: true,
    component_type: 'raw_material',
  })
  const [adjQty, setAdjQty] = useState('')
  const [adjDir, setAdjDir] = useState<'add' | 'reduce'>('add')
  const [adjNote, setAdjNote] = useState('')
  const [adjSaving, setAdjSaving] = useState(false)
  const [adjError, setAdjError] = useState('')
  const [adjSuccess, setAdjSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: c }, { data: s }, { data: b }, { data: authData }] = await Promise.all([
        supabase.from('components').select('*').eq('id', id).single(),
        supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('inventory_balances').select('quantity').eq('component_id', id).single(),
        supabase.auth.getUser(),
      ])
      if (c) {
        setForm({
          name: c.name ?? '',
          description: c.description ?? '',
          unit: c.unit ?? 'pcs',
          supplier_id: c.supplier_id ?? '',
          manufacturer_part_number: c.manufacturer_part_number ?? '',
          low_stock_threshold: c.low_stock_threshold?.toString() ?? '',
          notes: c.notes ?? '',
          is_active: c.is_active ?? true,
          component_type: (c.component_type === 'device' ? 'equipment' : c.component_type) ?? 'raw_material',
        })
      }
      setSuppliers(s ?? [])
      setCurrentStock(b?.quantity ?? 0)
      if (authData.user) setUserId(authData.user.id)
      setLoadingData(false)
    }
    load()
  }, [id])

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('components').update({
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      supplier_id: form.supplier_id || null,
      manufacturer_part_number: form.manufacturer_part_number || null,
      low_stock_threshold: form.low_stock_threshold ? parseFloat(form.low_stock_threshold) : null,
      notes: form.notes || null,
      is_active: form.is_active,
      component_type: form.component_type,
    }).eq('id', id)
    if (error) { setError(error.message); setSaving(false); return }
    router.push(`/components/${id}`)
    router.refresh()
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(adjQty)
    if (!qty || qty <= 0) { setAdjError('Enter a positive quantity'); return }
    setAdjError('')
    setAdjSuccess('')
    setAdjSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('inventory_transactions').insert({
      component_id: id,
      transaction_type: 'adjustment',
      quantity: qty,
      direction: adjDir === 'add' ? 1 : -1,
      notes: adjNote || (adjDir === 'add' ? 'Stock addition' : 'Stock reduction'),
      performed_by: userId || undefined,
    })
    if (error) { setAdjError(error.message); setAdjSaving(false); return }
    const newStock = adjDir === 'add' ? currentStock + qty : currentStock - qty
    setCurrentStock(newStock)
    setAdjQty('')
    setAdjNote('')
    setAdjSuccess(`Stock ${adjDir === 'add' ? 'increased' : 'reduced'} by ${qty}. New balance: ${newStock} ${form.unit}`)
    setAdjSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('components').delete().eq('id', id)
    if (error) { setDeleting(false); alert(error.message); return }
    router.push(`/components?type=${form.component_type}`)
    router.refresh()
  }

  if (loadingData) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href={`/components/${id}`} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="w-4 h-4" />Back to Component
      </Link>

      <Card>
        <CardHeader><CardTitle>Edit Component</CardTitle></CardHeader>
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
            <Input label="Component Name" value={form.name} onChange={e => set('name', e.target.value)} required />
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.description}
                onChange={e => set('description', e.target.value)}
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Supplier</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.supplier_id}
                onChange={e => set('supplier_id', e.target.value)}
              >
                <option value="">-- No supplier selected --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input
              label="Low Stock Threshold"
              type="number"
              min="0"
              step="0.01"
              value={form.low_stock_threshold}
              onChange={e => set('low_stock_threshold', e.target.value)}
              hint="Alert when inventory falls below this quantity."
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <label htmlFor="is_active" className="text-sm">Active component</label>
            </div>
            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving}>Save Changes</Button>
              <Link href={`/components/${id}`}><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Stock Adjustment</span>
            <span className="text-base font-normal text-[var(--muted-foreground)]">
              Current: <strong className="text-[var(--foreground)]">{currentStock} {form.unit}</strong>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjDir('add')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-sm font-medium transition-colors ${adjDir === 'add' ? 'bg-green-600 text-white border-green-600' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-green-600 hover:text-green-600'}`}
              >
                <Plus className="w-4 h-4" />Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAdjDir('reduce')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-sm font-medium transition-colors ${adjDir === 'reduce' ? 'bg-red-600 text-white border-red-600' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-red-600 hover:text-red-600'}`}
              >
                <Minus className="w-4 h-4" />Reduce Stock
              </button>
            </div>
            <Input
              label={`Quantity (${form.unit})`}
              type="number"
              min="0.001"
              step="0.001"
              value={adjQty}
              onChange={e => setAdjQty(e.target.value)}
              required
              placeholder="0"
            />
            <Input
              label="Note (optional)"
              value={adjNote}
              onChange={e => setAdjNote(e.target.value)}
              placeholder={adjDir === 'add' ? 'e.g. Received from supplier' : 'e.g. Used in experiment'}
            />
            {adjError && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{adjError}</p>}
            {adjSuccess && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">{adjSuccess}</p>}
            <Button
              type="submit"
              loading={adjSaving}
              className={adjDir === 'reduce' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {adjDir === 'add' ? 'Add to Stock' : 'Reduce Stock'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete this component</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Permanently removes the component and all its transaction history.</p>
              </div>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 shrink-0 ml-4"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />Delete
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-600">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button className="bg-red-600 hover:bg-red-700" loading={deleting} onClick={handleDelete}>
                  Yes, Delete Component
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
