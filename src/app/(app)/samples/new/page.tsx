'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface BuildTarget {
  id: string
  name: string
  value: string
  unit: string
  achieved: string
}

interface Product {
  id: string
  name: string
  code: string
}

export default function NewSamplePage() {
  const router = useRouter()
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    product_id: '',
    build_objective: '',
    notes: '',
    location: '',
  })
  const [buildTargets, setBuildTargets] = useState<BuildTarget[]>([])

  useEffect(() => {
    supabase.from('products').select('id, name, code').order('name').then(({ data }) => {
      if (data) setProducts(data)
    })
  }, [])

  function addTarget() {
    setBuildTargets(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', value: '', unit: '', achieved: '' },
    ])
  }

  function removeTarget(id: string) {
    setBuildTargets(prev => prev.filter(t => t.id !== id))
  }

  function updateTarget(id: string, field: keyof BuildTarget, value: string) {
    setBuildTargets(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const { error } = await supabase.from('samples').insert({
      name: form.name.trim(),
      product_id: form.product_id || null,
      build_objective: form.build_objective.trim() || null,
      notes: form.notes.trim() || null,
      location: form.location.trim() || null,
      status: 'approved_to_build',
      build_targets: buildTargets.filter(t => t.name.trim()),
    })

    setLoading(false)
    if (error) {
      alert('Error creating sample: ' + error.message)
    } else {
      router.push('/samples')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/samples" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Samples
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Sample</h1>
        <p className="text-sm text-gray-500 mt-1">New samples start in <strong>Approved to Build</strong> status</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sample Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Prototype A - High Flux Core"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select
              value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Lab A, Shelf 3"
            />
          </div>
        </div>

        {/* Build Specification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Build Specification</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Build Objective</label>
            <textarea
              value={form.build_objective}
              onChange={e => setForm(f => ({ ...f, build_objective: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the purpose and goals of this build sample…"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Build Targets</label>
              <button
                type="button"
                onClick={addTarget}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add Target
              </button>
            </div>

            {buildTargets.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No targets defined. Click Add Target to specify performance targets.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                  <div className="col-span-4">Parameter</div>
                  <div className="col-span-3">Target Value</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Achieved</div>
                  <div className="col-span-1"></div>
                </div>
                {buildTargets.map(t => (
                  <div key={t.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={t.name}
                        onChange={e => updateTarget(t.id, 'name', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. Flux density"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={t.value}
                        onChange={e => updateTarget(t.id, 'value', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. 1.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={t.unit}
                        onChange={e => updateTarget(t.id, 'unit', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="T"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={t.achieved}
                        onChange={e => updateTarget(t.id, 'achieved', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="TBD"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeTarget(t.id)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Any additional notes about this sample…"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/samples"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Sample'}
          </button>
        </div>
      </form>
    </div>
  )
}
