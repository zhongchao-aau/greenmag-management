'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUSES = [
  { value: 'approved_to_build', label: 'Approved to Build' },
  { value: 'material_preparation', label: 'Material Preparation' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'manufactured', label: 'Manufactured' },
  { value: 'in_test', label: 'In Test' },
  { value: 'post_test_analysis', label: 'Post-Test Analysis' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'retired', label: 'Retired' },
  { value: 'scrapped', label: 'Scrapped' },
]

interface Product { id: string; name: string; code: string }
interface Variant { id: string; name: string; code: string }

export default function EditSamplePage({ params }: { params: Promise<{ id: string }> }) {
  const [sampleId, setSampleId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [status, setStatus] = useState('approved_to_build')
  const [location, setLocation] = useState('')
  const [buildObjective, setBuildObjective] = useState('')
  const [notes, setNotes] = useState('')
  const [materialDate, setMaterialDate] = useState('')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [manufactureDate, setManufactureDate] = useState('')
  const [testDate, setTestDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Load products once
  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => { if (data) setProducts(data) })
  }, [])

  // Load sample data
  useEffect(() => {
    params.then(async ({ id }) => {
      setSampleId(id)
      const { data: sample } = await supabase
        .from('samples')
        .select('*')
        .eq('id', id)
        .single()

      if (sample) {
        setName(sample.name ?? '')
        setCode(sample.code ?? '')
        setProductId(sample.product_id ?? '')
        setVariantId(sample.variant_id ?? '')
        setStatus(sample.status ?? 'approved_to_build')
        setLocation((sample as any).location ?? '')
        setBuildObjective((sample as any).build_objective ?? '')
        setNotes((sample as any).notes ?? '')
        setMaterialDate((sample as any).material_date ?? '')
        setManufacturingDate((sample as any).manufacturing_date ?? '')
        setManufactureDate((sample as any).manufacture_date ?? '')
        setTestDate((sample as any).test_date ?? '')
      }
      setLoading(false)
    })
  }, [])

  // Load variants when product changes
  useEffect(() => {
    if (!productId) {
      setVariants([])
      return
    }
    supabase
      .from('product_variants')
      .select('id, name, code')
      .eq('product_id', productId)
      .order('name')
      .then(({ data }) => { if (data) setVariants(data) })
  }, [productId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!sampleId) return
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('samples')
      .update({
        name,
        product_id: productId || null,
        variant_id: variantId || null,
        status,
        location: location || null,
        build_objective: buildObjective || null,
        notes: notes || null,
        material_date: materialDate || null,
        manufacturing_date: manufacturingDate || null,
        manufacture_date: manufactureDate || null,
        test_date: testDate || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', sampleId)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
    } else {
      router.push(`/samples/${sampleId}`)
      router.refresh()
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/samples/${sampleId}`} className="text-sm text-gray-500 hover:text-gray-700">← Back to Sample</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Sample</h1>
        <p className="text-xs font-mono text-gray-400 mt-1">{code}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Product & Variant */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Product</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Product</label>
              <select
                value={productId}
                onChange={e => { setProductId(e.target.value); setVariantId('') }}
                className={inputClass}
              >
                <option value="">No product selected</option>
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
                  {!productId ? 'Select a product first' : variants.length === 0 ? 'No variants available' : 'No variant selected'}
                </option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.code} — {v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Sample Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className={labelClass}>Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Dates */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Milestone Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Material Ready</label>
              <input type="date" value={materialDate} onChange={e => setMaterialDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Manufacturing Start</label>
              <input type="date" value={manufacturingDate} onChange={e => setManufacturingDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Manufactured</label>
              <input type="date" value={manufactureDate} onChange={e => setManufactureDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Test Date</label>
              <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} className={inputClass} />
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
            placeholder="What is this sample being built for?"
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
            className={inputClass}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href={`/samples/${sampleId}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
