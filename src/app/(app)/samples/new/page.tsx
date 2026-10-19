'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUSES = [
  { value: 'approved_to_build', label: 'Approved to Build' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'in_test', label: 'In Test' },
  { value: 'failure_analysis', label: 'Failure Analysis' },
  { value: 'passed', label: 'Passed' },
  { value: 'retired', label: 'Retired' },
  { value: 'scrapped', label: 'Scrapped' },
]

interface Product { id: string; name: string; code: string }
interface Variant { id: string; name: string; code: string }

export default function NewSamplePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState('approved_to_build')
  const [location, setLocation] = useState('')
  const [buildObjective, setBuildObjective] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => { if (data) setProducts(data) })
  }, [])

  useEffect(() => {
    if (!productId) {
      setVariants([])
      setVariantId('')
      return
    }
    supabase
      .from('product_variants')
      .select('id, name, code')
      .eq('product_id', productId)
      .order('name')
      .then(({ data }) => {
        if (data) setVariants(data)
        setVariantId('')
      })
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Sample name is required'); return }
    if (!productId) { setError('Product is required'); return }
    if (quantity < 1 || quantity > 50) { setError('Quantity must be between 1 and 50'); return }

    setLoading(true)
    setError('')

    try {
      const { data: latest } = await supabase
        .from('samples')
        .select('code')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextNum = 1
      if (latest?.code) {
        const match = latest.code.match(/(\d+)$/)
        if (match) nextNum = parseInt(match[1]) + 1
      }

      const rows = Array.from({ length: quantity }, (_, i) => ({
        name: quantity > 1 ? `${name.trim()} #${i + 1}` : name.trim(),
        code: `GM-SMP-${String(nextNum + i).padStart(5, '0')}`,
        product_id: productId,
        variant_id: variantId || null,
        status,
        location: location.trim() || null,
        build_objective: buildObjective.trim() || null,
        notes: notes.trim() || null,
        build_targets: [],
      }))

      const { error: insertError } = await supabase.from('samples').insert(rows)
      if (insertError) throw insertError

      router.push('/samples')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create sample(s)')
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/samples" className="text-sm text-gray-500 hover:text-gray-700">← Back to Samples</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Register New Sample</h1>
        <p className="text-sm text-gray-500 mt-1">Create one or more build samples to track through the lifecycle</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product & Variant */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Product</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Product *</label>
              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select a product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Variant</label>
              <select
                value={variantId}
                onChange={e => setVariantId(e.target.value)}
                className={inputClass}
                disabled={!productId || variants.length === 0}
              >
                <option value="">
                  {!productId ? 'Select a product first' : variants.length === 0 ? 'No variants available' : 'Select a variant (optional)'}
                </option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.code} — {v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sample Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Sample Info</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Sample Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={quantity > 1 ? 'e.g. Proto-A  →  Proto-A #1, Proto-A #2…' : 'e.g. Proto-A'}
                className={inputClass}
                required
              />
              {quantity > 1 && name && (
                <p className="text-xs text-gray-400 mt-1">
                  Will create: "{name} #1" through "{name} #{quantity}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">Register multiple identical samples at once</p>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className={inputClass}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Lab A, Storage Room 3"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Build Objective */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Build Objective</h2>
          <textarea
            value={buildObjective}
            onChange={e => setBuildObjective(e.target.value)}
            rows={3}
            placeholder="What is this sample being built for? e.g. Validate winding process at 300A…"
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional notes or context…"
            className={inputClass}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href="/samples" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : quantity > 1 ? `Create ${quantity} Samples` : 'Create Sample'}
          </button>
        </div>
      </form>
    </div>
  )
}
