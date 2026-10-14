'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const EQUIPMENT_TYPES = ['equipment']
const INVENTORY_TYPES = ['raw_material', 'consumable']

const TYPE_LABELS: Record<string, { label: string; prefix: string; color: string }> = {
  raw_material: { label: 'Raw Material', prefix: 'RM', color: 'bg-blue-100 text-blue-700' },
  consumable: { label: 'Consumable', prefix: 'CS', color: 'bg-amber-100 text-amber-700' },
  equipment: { label: 'Lab Equipment', prefix: 'EQ', color: 'bg-violet-100 text-violet-700' },
}

type ComponentOption = {
  id: string
  code: string
  name: string
  unit: string
  component_type: string
  quantity: number
}

type UsageItem = {
  component_id: string
  quantity: string
  notes: string
}

function toLocalDate(d: Date) {
  return d.toLocaleDateString('sv-SE') // yields YYYY-MM-DD in local time
}

export default function NewUsagePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [components, setComponents] = useState<ComponentOption[]>([])
  const [form, setForm] = useState({ used_at: toLocalDate(new Date()), notes: '' })
  const [items, setItems] = useState<UsageItem[]>([{ component_id: '', quantity: '', notes: '' }])

  useEffect(() => {
    async function load() {
      const [{ data: comps }, { data: balances }] = await Promise.all([
        supabase
          .from('components')
          .select('id, code, name, unit, component_type')
          .eq('is_active', true)
          .order('code'),
        supabase
          .from('inventory_balances')
          .select('component_id, quantity'),
      ])

      const balanceMap = new Map(
        (balances ?? []).map((b: { component_id: string; quantity: number }) => [b.component_id, b.quantity])
      )

      setComponents(
        (comps ?? []).map((c: { id: string; code: string; name: string; unit: string; component_type: string | null }) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          unit: c.unit,
          component_type: c.component_type ?? 'raw_material',
          quantity: balanceMap.get(c.id) ?? 0,
        }))
      )
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function getComp(item: UsageItem): ComponentOption | undefined {
    return components.find(c => c.id === item.component_id)
  }

  function isEquipment(item: UsageItem): boolean {
    const c = getComp(item)
    return c ? EQUIPMENT_TYPES.includes(c.component_type) : false
  }

  function addItem() {
    setItems(prev => [...prev, { component_id: '', quantity: '', notes: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function setItem(idx: number, patch: Partial<UsageItem>) {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    for (const [i, item] of items.entries()) {
      if (!item.component_id) {
        setError(`Row ${i + 1}: please select a component.`)
        return
      }
      if (!isEquipment(item)) {
        const qty = parseFloat(item.quantity)
        const comp = getComp(item)!
        if (!qty || qty <= 0) {
          setError(`Row ${i + 1}: quantity must be greater than 0.`)
          return
        }
        if (qty > comp.quantity) {
          setError(`Row ${i + 1}: only ${comp.quantity} ${comp.unit} in stock.`)
          return
        }
      }
    }

    setSubmitting(true)

    const txRows = items.map(item => {
      const comp = getComp(item)!
      const eq = EQUIPMENT_TYPES.includes(comp.component_type)
      const notes = [form.notes, item.notes].filter(Boolean).join(' | ') || null
      return eq
        ? {
            component_id: item.component_id,
            transaction_type: 'equipment_in_use',
            quantity: 0, // no inventory impact
            notes,
          }
        : {
            component_id: item.component_id,
            transaction_type: 'usage',
            quantity: -parseFloat(item.quantity), // negative = deduction (trigger adds NEW.quantity to balance)
            notes,
          }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: txError } = await supabase.from('inventory_transactions').insert(txRows as any)
    if (txError) {
      setError(txError.message)
      setSubmitting(false)
      return
    }

    router.push('/inventory')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-gray-400 text-sm">Loading components…</div>
    )
  }

  // Group by type for the select dropdown
  const TYPE_ORDER = ['raw_material', 'consumable', 'equipment']

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400">
        <Link href="/usage" className="hover:text-gray-600 transition-colors">Usage</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Record Usage</span>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">Record Usage</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Usage details card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Usage Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.used_at}
                onChange={e => setForm(f => ({ ...f, used_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Purpose, batch, experiment…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Component rows */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Components</h2>

          {items.map((item, idx) => {
            const comp = getComp(item)
            const eq = comp ? EQUIPMENT_TYPES.includes(comp.component_type) : false
            const typeInfo = comp ? (TYPE_LABELS[comp.component_type] ?? TYPE_LABELS.raw_material) : null

            return (
              <div key={idx} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                {/* Component selector + remove */}
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Component</label>
                    <select
                      value={item.component_id}
                      onChange={e => setItem(idx, { component_id: e.target.value, quantity: '' })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select component…</option>
                      {TYPE_ORDER.map(type => {
                        const typeComps = components.filter(c => c.component_type === type)
                        if (!typeComps.length) return null
                        const tl = TYPE_LABELS[type]
                        return (
                          <optgroup key={type} label={tl?.label ?? type}>
                            {typeComps.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.code} — {c.name}
                                {INVENTORY_TYPES.includes(type) ? ` (${c.quantity} ${c.unit})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="mt-6 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Type badge + stock info */}
                {comp && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo?.color}`}>
                      {typeInfo?.prefix} · {typeInfo?.label}
                    </span>
                    {!eq && (
                      <span className="text-xs text-gray-500">
                        In stock: <span className="font-semibold text-gray-700">{comp.quantity} {comp.unit}</span>
                      </span>
                    )}
                    {eq && (
                      <span className="text-xs font-medium text-violet-600">
                        ⚡ Will be logged as in use (no quantity deducted)
                      </span>
                    )}
                  </div>
                )}

                {/* Quantity + notes for RM/consumable */}
                {comp && !eq && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Quantity ({comp.unit})
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        max={comp.quantity}
                        step="any"
                        value={item.quantity}
                        onChange={e => setItem(idx, { quantity: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Item Notes</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => setItem(idx, { notes: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                )}

                {/* Notes only for equipment */}
                {comp && eq && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Item Notes</label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={e => setItem(idx, { notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="What it's being used for…"
                    />
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={addItem}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            + Add another component
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-1">
          <Link
            href="/usage"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Recording…' : 'Record Usage'}
          </button>
        </div>
      </form>
    </div>
  )
}
