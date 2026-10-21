'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface OrderItem {
  component_id: string
  component_name: string
  supplier_name: string
  quantity: string
  unit: string
  unit_price: string
  currency: string
  notes: string
}

interface Component {
  id: string
  name: string
  code: string | null
  unit: string
  supplier_id: string | null
  supplier_name: string | null
}

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('request')

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [components, setComponents] = useState<Component[]>([])
  const [error, setError] = useState('')
  const [linkedRequest, setLinkedRequest] = useState<{ id: string; code: string; purpose: string | null } | null>(null)

  const [description, setDescription] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([
    { component_id: '', component_name: '', supplier_name: '', quantity: '', unit: 'pcs', unit_price: '', currency: 'EUR', notes: '' }
  ])

  const CURRENCIES = ['EUR', 'USD', 'CNY', 'GBP', 'DKK']
  const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { router.push('/dashboard'); return }

      const { data: c } = await supabase
        .from('components')
        .select('id, name, code, unit, supplier_id, suppliers(name)')
        .eq('is_active', true)
        .order('name')

      const mapped = (c || []).map((comp: any) => ({
        id: comp.id, name: comp.name, code: comp.code, unit: comp.unit,
        supplier_id: comp.supplier_id, supplier_name: comp.suppliers?.name || null,
      }))
      setComponents(mapped)

      if (requestId) {
        const { data: req } = await supabase
          .from('purchase_requests')
          .select('id, code, purpose, request_items(component_id, quantity_requested, notes, component:components(code, name, unit))')
          .eq('id', requestId)
          .single()
        if (req) {
          setLinkedRequest({ id: req.id, code: req.code, purpose: req.purpose })
          if (req.purpose) setDescription(req.purpose)
          const reqItems = (req as any).request_items ?? []
          if (reqItems.length > 0) {
            setItems(reqItems.map((i: any) => {
              const comp = mapped.find((m: Component) => m.id === i.component_id)
              return {
                component_id: i.component_id,
                component_name: i.component?.name ?? '',
                supplier_name: comp?.supplier_name || '',
                quantity: String(i.quantity_requested),
                unit: i.component?.unit ?? 'pcs',
                unit_price: '',
                currency: 'EUR',
                notes: i.notes ?? '',
              }
            }))
          }
        }
      }
      setLoadingData(false)
    }
    load()
  }, [requestId])

  function addItem() {
    setItems(prev => [...prev, { component_id: '', component_name: '', supplier_name: '', quantity: '', unit: 'pcs', unit_price: '', currency: 'EUR', notes: '' }])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'component_id') {
        const comp = components.find(c => c.id === value)
        return { ...item, component_id: value, component_name: comp?.name || '', supplier_name: comp?.supplier_name || '', unit: comp?.unit || 'pcs' }
      }
      return { ...item, [field]: value }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!description.trim()) { setError('Please enter a description.'); return }
    const validItems = items.filter(i => i.component_id && i.quantity)
    if (validItems.length === 0) { setError('Add at least one item with a component and quantity.'); return }
    setLoading(true)
    const supabase = createClient()

    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .insert({
        notes: description,
        supplier_ref: orderNotes || null,
        expected_delivery: expectedDelivery || null,
        status: 'draft',
      })
      .select('id')
      .single()

    if (orderErr || !order) { setError(orderErr?.message ?? 'Failed to create order'); setLoading(false); return }

    if (requestId) {
      await supabase.from('purchase_orders').update({ request_id: requestId }).eq('id', order.id)
    }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      validItems.map(item => ({
        order_id: order.id,
        component_id: item.component_id,
        item_name: item.component_name || item.component_id,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
        currency: item.currency || 'EUR',
        notes: item.notes || null,
      }))
    )
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }
    router.push(`/orders/${order.id}`)
    router.refresh()
  }

  if (loadingData) return <div className="flex items-center justify-center min-h-screen"><div className="text-muted-foreground">Loading...</div></div>

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Orders</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Purchase Order</h1>
          {linkedRequest && (
            <p className="text-sm text-muted-foreground mt-0.5">
              From request <Link href={`/requests/${linkedRequest.id}`} className="text-[var(--primary)] hover:underline">{linkedRequest.code}</Link>
              {linkedRequest.purpose && ` · ${linkedRequest.purpose}`}
            </p>
          )}
        </div>
      </div>

      {error && <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle><CardDescription>Basic order information</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium leading-none">Description *</label>
              <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Winding wire batch Q3 2026" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="delivery" className="text-sm font-medium leading-none">Expected Delivery</label>
              <Input id="delivery" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="max-w-xs" />
            </div>
            <div className="space-y-2">
              <label htmlFor="orderNotes" className="text-sm font-medium leading-none">Order Notes</label>
              <textarea id="orderNotes" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder="Any additional notes for this order..." rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Supplier is determined by the selected component</CardDescription>
            </div>
            <Button type="button" onClick={addItem} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add Item</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 && <p className="text-center text-muted-foreground py-6">No items. Add at least one item.</p>}
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Component *</label>
                    <select value={item.component_id} onChange={e => updateItem(index, 'component_id', e.target.value)} className={selectCls} required>
                      <option value="">-- Select component --</option>
                      {components.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Supplier</label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                      {item.supplier_name || (item.component_id ? 'No supplier linked' : '—')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Quantity *</label>
                    <Input type="number" min="0.01" step="any" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} placeholder="0" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unit</label>
                    <Input value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)} placeholder="pcs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unit Price</label>
                    <Input type="number" min="0" step="any" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Currency</label>
                    <select value={item.currency} onChange={e => updateItem(index, 'currency', e.target.value)} className={selectCls}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Item Notes</label>
                  <Input value={item.notes} onChange={e => updateItem(index, 'notes', e.target.value)} placeholder="Optional notes for this item" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/orders"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Purchase Order'}</Button>
        </div>
      </form>
    </div>
  )
}
