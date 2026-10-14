'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type RequestType = 'procure' | 'build' | 'component_update' | 'component_new'

const TAB_LABELS: Record<RequestType, string> = {
  procure: 'Procure',
  build: 'Build Sample',
  component_update: 'Component Update',
  component_new: 'New Component',
}

const COMPONENT_TYPES = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
]

interface Component {
  id: string
  code: string
  name: string
  unit: string
  component_type: string
}

interface Product {
  id: string
  name: string
}

interface Variant {
  id: string
  code: string
  name: string
  product_id: string
  products: { id: string; name: string } | null
}

function generateRequestCode() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `GM-REQ-${ts}${rand}`
}

export default function NewRequestPage() {
  const router = useRouter()
  const [requestType, setRequestType] = useState<RequestType>('procure')
  const [components, setComponents] = useState<Component[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('all')

  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ component_id: '', quantity: '', notes: '' }])
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantityToBuild, setQuantityToBuild] = useState(1)
  const [newComponent, setNewComponent] = useState({
    name: '',
    code: '',
    unit: '',
    type: 'raw_material',
    description: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: comps }, { data: vars }] = await Promise.all([
        supabase.from('components').select('id, code, name, unit, component_type').eq('is_active', true).order('name'),
        supabase.from('product_variants').select('id, code, name, product_id, products(id, name)').eq('status', 'active').order('name'),
      ])
      setComponents((comps as any) ?? [])
      const allVars: Variant[] = (vars as any) ?? []
      setVariants(allVars)

      // Extract unique products from variants
      const seen = new Set<string>()
      const prods: Product[] = []
      allVars.forEach(v => {
        const p = v.products as any
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id)
          prods.push({ id: p.id, name: p.name })
        }
      })
      prods.sort((a, b) => a.name.localeCompare(b.name))
      setProducts(prods)
    }
    load()
  }, [])

  const filteredComponents = componentTypeFilter === 'all'
    ? components
    : components.filter(c => c.component_type === componentTypeFilter)

  const filteredVariants = productId
    ? variants.filter(v => (v.products as any)?.id === productId)
    : variants

  function addItem() { setItems(prev => [...prev, { component_id: '', quantity: '', notes: '' }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: string, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!purpose.trim()) { setError('Purpose is required.'); return }
    if (requestType === 'procure') {
      if (!items.every(item => item.component_id && item.quantity && Number(item.quantity) > 0)) {
        setError('All items must have a component and a valid quantity.'); return
      }
    }
    if (requestType === 'build') {
      if (!variantId) { setError('Please select a product variant.'); return }
      if (quantityToBuild < 1) { setError('Quantity must be at least 1.'); return }
    }
    if (requestType === 'component_new') {
      if (!newComponent.name.trim()) { setError('Component name is required.'); return }
      if (!newComponent.unit.trim()) { setError('Unit is required.'); return }
    }
    setSaving(true)
    const supabase = createClient()

    let finalNotes = notes.trim() || null
    if (requestType === 'component_new') {
      const parts = [
        'New component request:',
        `Name: ${newComponent.name}`,
        newComponent.code ? `Code: ${newComponent.code}` : null,
        `Unit: ${newComponent.unit}`,
        `Type: ${newComponent.type}`,
        newComponent.description ? `Description: ${newComponent.description}` : null,
        notes.trim() ? `\nAdditional notes: ${notes.trim()}` : null,
      ].filter(Boolean)
      finalNotes = parts.join('\n')
    }

    const insertPayload: any = {
      code: generateRequestCode(),
      purpose: purpose.trim(),
      notes: finalNotes,
      request_type: requestType,
      status: 'draft',
    }
    if (requestType === 'build') {
      insertPayload.variant_id = variantId
      insertPayload.quantity_to_build = quantityToBuild
    }

    const { data: req, error: err } = await supabase
      .from('purchase_requests').insert(insertPayload).select('id').single()
    if (err) { setError(err.message); setSaving(false); return }

    if (requestType === 'procure') {
      const { error: itemErr } = await supabase.from('request_items').insert(
        items.map(item => ({
          request_id: req.id,
          component_id: item.component_id,
          quantity_requested: Number(item.quantity),
          notes: item.notes.trim() || null,
        }))
      )
      if (itemErr) { setError(itemErr.message); setSaving(false); return }
    }

    router.push(`/requests/${req.id}`)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/requests" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Requests
      </Link>
      <Card>
        <CardHeader><CardTitle>New Request</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-1 p-1 bg-[var(--secondary)] rounded-lg mb-6">
            {(Object.keys(TAB_LABELS) as RequestType[]).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => { setRequestType(type); setError(''); setProductId(''); setVariantId('') }}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                  requestType === type
                    ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {TAB_LABELS[type]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Purpose <span className="text-[var(--destructive)]">*</span></label>
              <input
                type="text"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Brief purpose for this request"
              />
            </div>

            {requestType === 'procure' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Filter by Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {[{ value: 'all', label: 'All' }, ...COMPONENT_TYPES].map(ct => (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => setComponentTypeFilter(ct.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          componentTypeFilter === ct.value
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                            : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'
                        }`}
                      >{ct.label}</button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-medium">Items</label>
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        value={item.component_id}
                        onChange={e => updateItem(idx, 'component_id', e.target.value)}
                        required
                      >
                        <option value="">Select component…</option>
                        {filteredComponents.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.unit}) — {(c.component_type ?? '').replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number" min="1"
                      className="w-24 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                      placeholder="Qty" value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)} required
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] text-lg leading-none mt-2">×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-[var(--primary)] hover:underline">+ Add item</button>
              </div>
            )}

            {requestType === 'build' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Product <span className="text-[var(--destructive)]">*</span></label>
                  <select
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    value={productId}
                    onChange={e => { setProductId(e.target.value); setVariantId('') }}
                    required
                  >
                    <option value="">Select product…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Variant <span className="text-[var(--destructive)]">*</span></label>
                  <select
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    value={variantId}
                    onChange={e => setVariantId(e.target.value)}
                    required
                    disabled={!productId}
                  >
                    <option value="">{productId ? 'Select variant…' : 'Select a product first…'}</option>
                    {filteredVariants.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Quantity to Build <span className="text-[var(--destructive)]">*</span></label>
                  <input
                    type="number" min="1" max="100"
                    className="w-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    value={quantityToBuild}
                    onChange={e => setQuantityToBuild(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              </div>
            )}

            {requestType === 'component_update' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Component</label>
                  <select className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent">
                    <option value="">Select component to update…</option>
                    {components.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
              </div>
            )}

            {requestType === 'component_new' && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">Request creation of a new component that doesn't exist in the system yet.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Component Name <span className="text-[var(--destructive)]">*</span></label>
                    <input type="text"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                      value={newComponent.name} onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Copper wire 0.5mm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Suggested Code</label>
                    <input type="text"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                      value={newComponent.code} onChange={e => setNewComponent(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="e.g. CW-0.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit <span className="text-[var(--destructive)]">*</span></label>
                    <input type="text"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                      value={newComponent.unit} onChange={e => setNewComponent(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="e.g. m, kg, pcs" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <select
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                      value={newComponent.type} onChange={e => setNewComponent(prev => ({ ...prev, type: e.target.value }))}>
                      {COMPONENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description / Specification</label>
                  <textarea
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    value={newComponent.description} onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the component specifications, where it's sourced, why it's needed…" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">{requestType === 'component_new' ? 'Additional Notes' : 'Notes'}</label>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional additional notes" />
            </div>

            {error && <p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Request'}</Button>
              <Link href="/requests"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
