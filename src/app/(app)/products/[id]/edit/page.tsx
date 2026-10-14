'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

const CATEGORIES = ['Magnet Assembly', 'Rotor', 'Stator', 'Electronics', 'Housing', 'Rubicon-AC Inductor', 'Other']
const STATUSES = ['active', 'prototype', 'obsolete', 'discontinued'] as const

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [form, setForm] = useState({ name: '', category: '', description: '', status: 'active' as string })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(async ({ id: productId }) => {
      setId(productId)
      const supabase = createClient()
      const { data } = await supabase.from('products').select('name, category, description, status').eq('id', productId).single()
      if (data) {
        setForm({
          name: data.name ?? '',
          category: data.category ?? '',
          description: data.description ?? '',
          status: data.status ?? 'active',
        })
      }
      setLoading(false)
    })
  }, [params])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Product name is required'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.from('products').update({
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      status: form.status,
    }).eq('id', id)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    router.push(`/products/${id}`)
    router.refresh()
  }

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/products/${id}`} className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Product
        </Link>
        <h1 className="text-xl font-semibold">Edit Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Product Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Optional description..."
            className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/products/${id}`}>
            <button type="button" className="px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-md hover:bg-[var(--secondary)]">
              Cancel
            </button>
          </Link>
        </div>
      </form>
    </div>
  )
}
