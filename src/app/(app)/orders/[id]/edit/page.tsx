'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface OrderItem {
  id?: string
  component_id: string
  component_name: string
  quantity_ordered: string
  unit: string
  unit_price: string
  currency: string
  notes: string
  _delete?: boolean
}

interface Supplier {
  id: string
  name: string
}

interface Component {
  id: string
  name: string
  unit: string
  code: string | null
}

export default function EditOrderPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [supplierId, setSupplierId] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [notes, setNotes] = useState('')
  const [orderStatus, setOrderStatus] = useState('')

  const [items, setItems] = useState<OrderItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [components, setComponents] = useState<Component[]>([])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      setIsAdmin(true)

      const { data: order, error: orderErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single()

      if (orderErr || !order) {
        setError('Order not found')
        setLoading(false)
        return
      }

      setSupplierId(order.supplier_id || '')
      setExpectedDelivery(order.expected_delivery ? order.expected_delivery.split('T')[0] : '')
      setNotes(order.notes || '')
      setOrderStatus(order.status || '')

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*, components(name, unit, code)')
        .eq('order_id', id)

      if (orderItems) {
        setItems(orderItems.map((oi: any) => ({
          id: oi.id,
          component_id: oi.component_id,
          component_name: oi.components?.name || '',
          quantity_ordered: String(oi.quantity),
          unit: oi.unit || oi.components?.unit || 'pcs',
          unit_price: String(oi.unit_price || ''),
          currency: oi.currency || 'EUR',
          notes: oi.notes || '',
        })))
      }

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      setSuppliers(suppliersData || [])

      const { data: componentsData } = await supabase
        .from('components')
        .select('id, name, unit, code')
        .eq('is_active', true)
        .order('name')
      setComponents(componentsData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function addItem() {
    setItems(prev => [...prev, {
      component_id: '',
      component_name: '',
      quantity_ordered: '',
      unit: 'pcs',
      unit_price: '',
      currency: 'EUR',
      notes: '',
    }])
  }

  function removeItem(index: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (item.id) return { ...item, _delete: true }
      return null
    }).filter(Boolean) as OrderItem[])
  }

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'component_id') {
        const comp = components.find(c => c.id === value)
        return { ...item, component_id: value, component_name: comp?.name || '', unit: comp?.unit || 'pcs' }
      }
      return { ...item, [field]: value }
    }))
  }

  const visibleItems = items.filter(it => !it._delete)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (!supplierId) throw new Error('Please select a supplier')
      const validItems = visibleItems.filter(it => it.component_id && it.quantity_ordered)
      if (validItems.length === 0) throw new Error('Please add at least one item')

      const { error: updateErr } = await supabase
        .from('purchase_orders')
        .update({ supplier_id: supplierId, expected_delivery: expectedDelivery || null, notes: notes || null })
        .eq('id', id)
      if (updateErr) throw updateErr

      const toDelete = items.filter(it => it._delete && it.id)
      for (const item of toDelete) {
        await supabase.from('order_items').delete().eq('id', item.id!)
      }

      for (const item of visibleItems) {
        if (item.id) {
          await supabase.from('order_items').update({
            component_id: item.component_id,
            quantity: parseFloat(item.quantity_ordered) || 0,
            unit: item.unit,
            unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
            currency: item.currency,
            notes: item.notes || null,
          }).eq('id', item.id)
        } else {
          await supabase.from('order_items').insert({
            order_id: id,
            component_id: item.component_id,
            quantity: parseFloat(item.quantity_ordered) || 0,
            unit: item.unit,
            unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
            currency: item.currency,
            notes: item.notes || null,
          })
        }
      }
      router.push(`/orders/${id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error: delErr } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (delErr) throw delErr
      router.push('/orders')
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading order...</div>
      </div>
    )
  }

  const isEditable = ['approved', 'ordered'].includes(orderStatus)

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/orders/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Order
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Order</h1>
          <p className="text-sm text-muted-foreground">Modify order details and items</p>
        </div>
      </div>

      {!isEditable && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            This order has status <strong>{orderStatus}</strong>. Only orders in &quot;approved&quot; or &quot;ordered&quot; status can be edited.
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Basic order information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="supplier">Supplier *</label>
              <select id="supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)} disabled={!isEditable} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">-- Select supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="delivery">Expected Delivery</label>
              <Input id="delivery" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} disabled={!isEditable} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." disabled={!isEditable} rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Components included in this order</CardDescription>
          </div>
          {isEditable && (
            <Button onClick={addItem} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleItems.length === 0 && (
            <p className="text-center text-muted-foreground py-6">No items. Add at least one item.</p>
          )}
          {visibleItems.map((item, index) => {
            const realIndex = items.indexOf(item)
            return (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  {isEditable && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(realIndex)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs">Component *</label>
                    <select value={item.component_id} onChange={e => updateItem(realIndex, 'component_id', e.target.value)} disabled={!isEditable} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">-- Select component --</option>
                      {components.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs">Quantity *</label>
                      <Input type="number" min="0" step="any" value={item.quantity_ordered} onChange={e => updateItem(realIndex, 'quantity_ordered', e.target.value)} placeholder="0" disabled={!isEditable} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">Unit</label>
                      <Input value={item.unit} onChange={e => updateItem(realIndex, 'unit', e.target.value)} placeholder="pcs" disabled={!isEditable} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs">Unit Price</label>
                      <Input type="number" min="0" step="any" value={item.unit_price} onChange={e => updateItem(realIndex, 'unit_price', e.target.value)} placeholder="0.00" disabled={!isEditable} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">Currency</label>
                      <select value={item.currency} onChange={e => updateItem(realIndex, 'currency', e.target.value)} disabled={!isEditable} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="CNY">CNY</option>
                        <option value="DKK">DKK</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs">Notes</label>
                    <Input value={item.notes} onChange={e => updateItem(realIndex, 'notes', e.target.value)} placeholder="Optional notes for this item" disabled={!isEditable} />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {isEditable && (
        <div className="flex justify-end gap-3">
          <Link href={`/orders/${id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete this order and all its items</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Order
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-medium">
                Are you sure? This will permanently delete the order and all its items. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, Delete Order'}
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}