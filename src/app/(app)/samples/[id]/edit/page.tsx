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

export default function EditSamplePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()

  const [id, setId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    product_id: '',
    status: 'approved_to_build',
    build_objective: '',
    notes: '',
    location: '',
    manufacture_date: '',
    material_date: '',
    manufacturing_date: '',
    test_date: '',
  })
  const [buildTargets, setBuildTargets] = useState<BuildTarget[]>([])

  useEffect(() => {
    params.then(p => {
      setId(p.id)

      Promise.all([
        supabase.from('samples').select('*').eq('id', p.id).single(),
        supabase.from('products').select('id, name, code').order('name'),
      ]).then(([{ data: sample }, { data: prods }]) => {
        if (sample) {
          setForm({
            name: sample.name ?? '',
            product_id: sample.product_id ?? '',
            status: sample.status ?? 'approved_to_build',
            build_objective: (sample as any).build_objective ?? '',
            notes: sample.notes ?? '',
            location: sample.location ?? '',
            manufacture_date: sample.manufacture_date ?? '',
            material_date: (sample as any).material_date ?? '',
            manufacturing_date: (sample as any).manufacturing_date ?? '',
            test_date: (sample as any).test_date ?? '',
          })
          const targets = Array.isArray((sample as any).build_targets) ? (sample as any).build_targets : []
          setBuildTargets(targets.map((t: any) => ({ ...t, id: t.id ?? crypto.randomUUID() })))
        }
        if (prods) setProducts(prods)
        setLoading(false)
      })
    })
  }, [])

  function addTarget() {
    setBuildTargets(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', value: '', unit: '', achieved: '' },
    ])
  }

  function removeTarget(tid: string) {
    setBuildTargets(prev => prev.filter(t => t.id !== tid))
  }

  function updateTarget(tid: string, field: keyof BuildTarget, value: string) {
    setBuildTargets(prev =>
      prev.map(t => t.id === tid ? { ...t, [field]: value } : t)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)

    const { error } = await supabase
      .from('samples')
      .update({
        name: form.name.trim(),
        product_id: form.product_id || null,
        status: form.status,
        build_objective: form.build_objective.trim() || null,
        notes: form.notes.trim() || null,
        location: form.location.trim() || null,
        manufacture_date: form.manufacture_date || null,
        material_date: form.material_date || null,
        manufacturing_date: form.manufacturing_date || null,
        test_date: form.test_date || null,
        build_targets: buildTargets.filter(t => t.name.trim()),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id)

    setSaving(false)
    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      router.push(`/samples/${id}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-48">
        <div className="text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/samples/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Sample
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Sample</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <option value="">— No product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
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

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Milestone Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Preparation Date</label>
              <input type="date" value={form.material_date} onChange={e => setForm(f => ({ ...f, material_date: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturing Date</label>
              <input type="date" value={form.manufacturing_date} onChange={e => setForm(f => ({ ...f, manufacturing_date: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date</label>
              <input type="date" value={form.manufacture_date} onChange={e => setForm(f => ({ ...f, manufacture_date: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
              <input type="date" value={form.test_date} onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

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
              <button type="button" onClick={addTarget} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                + Add Target
              </button>
            </div>

            {buildTargets.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No targets defined.</p>
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
                      <input type="text" value={t.name} onChange={e => updateTarget(t.id, 'name', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Flux density" />
                    </div>
                    <div className="col-span-3">
                      <input type="text" value={t.value} onChange={e => updateTarget(t.id, 'value', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. 1.5" />
                    </div>
                    <div className="col-span-2">
                      <input type="text" value={t.unit} onChange={e => updateTarget(t.id, 'unit', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="T" />
                    </div>
                    <div className="col-span-2">
                      <input type="text" value={t.achieved} onChange={e => updateTarget(t.id, 'achieved', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="TBD" />
                    </div>
                    <div className="col-span-1 text-center">
                      <button type="button" onClick={() => removeTarget(t.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/samples/${id}`} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
