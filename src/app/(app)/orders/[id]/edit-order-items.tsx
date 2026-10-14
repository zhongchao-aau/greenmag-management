'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { formatQuantity, formatCurrency } from '@/lib/utils'

type Component = { id: string; code: string; name: string; unit: string }
type OrderItem = {
  id: string
  quantity: number
  unit: string
  unit_price: number | null
  currency: string | null
  total_cost: number | null
  notes: string | null
  component: Component | null
}

const CURRENCIES = ['EUR', 'USD', 'CNY', 'DKK', 'GBP']

export function EditOrderItems({ orderId, isAdmin }: { orderId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<OrderItem[]>([])
  const [allComponents, setAllComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newComponentId, setNewComponentId] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState('EUR')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const promises: Promise<{ data: unknown[] | null }>[] = [
        supabase.from('order_items')
          .select('id, quantity, unit, unit_price, currency, total_cost, notes, component:components(id, code, name, unit)')
          .eq('order_id', orderId) as any,
      ]
      if (isAdmin) {
        promises.push(supabase.from('components').select('id, code, name, unit').order('name') as any)
      }
      const [itemsResult, componentsResult] = await Promise.all(promises)
      setItems(((itemsResult as { data: unknown[] | null }).data ?? []) as OrderItem[])
      if (componentsResult) {
        setAllComponents(((componentsResult as { data: unknown[] | null }).data ?? []) as Component[])
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  async function deleteItem(itemId: string) {
    setDeletingId(itemId)
    setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('order_items') as any).delete().eq('id', itemId)
    if (err) { setError(err.message); setDeletingId(null); return }
    setItems(prev => prev.filter(i => i.id !== itemId))
    setDeletingId(null)
  }

  async function addItem() {
    if (!newComponentId || !newQty) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const comp = allComponents.find(c => c.id === newComponentId)
    const { data, error: err } = await (supabase.from('order_items') as any)
      .insert({
        order_id: orderId,
        component_id: newComponentId,
        item_name: comp?.name ?? 'Unknown',
        quantity: parseFloat(newQty),
        unit: comp?.unit ?? 'pcs',
        unit_price: newPrice ? parseFloat(newPrice) : null,
        currency: newPrice ? newCurrency : null,
        notes: newNotes || null,
      })
      .select('id, quantity, unit, unit_price, currency, total_cost, notes, component:components(id, code, name, unit)')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setItems(prev => [...prev, data as OrderItem])
    setNewComponentId('')
    setNewQty('1')
    setNewPrice('')
    setNewNotes('')
    setSaving(false)
  }

  const selectedComp = allComponents.find(c => c.id === newComponentId)

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-[var(--muted-foreground)]">Loading…</p></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Order Items</CardTitle>
          {isAdmin && (
            <button
              onClick={() => setEditing(e => !e)}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              <Pencil className="w-3 h-3" />{editing ? 'Done' : 'Edit Items'}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 && !editing ? (
          <p className="text-sm text-[var(--muted-foreground)]">No items yet.{isAdmin ? ' Click “Edit Items” to add components.' : ''}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left pb-2 pr-4 text-xs text-[var(--muted-foreground)] font-medium">Component</th>
                  <th className="text-right pb-2 pr-4 text-xs text-[var(--muted-foreground)] font-medium whitespace-nowrap">Quantity</th>
                  {isAdmin && <th className="text-right pb-2 text-xs text-[var(--muted-foreground)] font-medium whitespace-nowrap">Unit Price</th>}
                  {editing && <th className="pb-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium">{item.component?.name ?? '—'}</p>
                      <p className="text-xs font-mono text-[var(--muted-foreground)]">{item.component?.code}</p>
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {formatQuantity(item.quantity)}&nbsp;{item.unit}
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-right whitespace-nowrap">
                        {item.unit_price ? formatCurrency(item.unit_price, item.currency ?? 'EUR') : '—'}
                      </td>
                    )}
                    {editing && (
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="text-red-400 hover:text-red-600 p-1 disabled:opacity-40"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="mt-4 border-t border-[var(--border)] pt-4 space-y-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Add component</p>
            <select
              value={newComponentId}
              onChange={e => setNewComponentId(e.target.value)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--background)]"
            >
              <option value="">Select component…</option>
              {allComponents.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.code}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number" min="0" step="any"
                  value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                  placeholder="Qty"
                  className="w-24 border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--background)]"
                />
                {selectedComp && <span className="text-xs text-[var(--muted-foreground)]">{selectedComp.unit}</span>}
              </div>
              <input
                type="number" min="0" step="any"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="Unit price (opt)"
                className="flex-1 border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--background)]"
              />
              <select
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value)}
                className="border border-[var(--border)] rounded-md px-2 py-1.5 text-sm bg-[var(--background)]"
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <input
              type="text"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--background)]"
            />
            <button
              onClick={addItem}
              disabled={!newComponentId || !newQty || saving}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[var(--border)] rounded-md py-2 text-sm text-[var(--muted-foreground)] hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />{saving ? 'Adding…' : 'Add to Order'}
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
