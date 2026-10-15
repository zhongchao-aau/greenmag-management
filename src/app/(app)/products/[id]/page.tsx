import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddVariantForm } from './add-variant-form'
import { BomManager } from './bom-manager'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!product) notFound()

  const { data: variants } = await supabase
    .from('product_variants')
    .select(`
      id, code, name, description, status,
      bill_of_materials(
        id, quantity, unit, notes,
        component:components(id, code, name, unit)
      )
    `)
    .eq('product_id', id)
    .order('created_at', { ascending: true })

  const { data: components } = await supabase
    .from('components')
    .select('id, code, name, unit')
    .order('name', { ascending: true })

  const isAdmin = profile?.role === 'admin'

  const statusClass: Record<string, string> = {
    active: 'badge-approved',
    prototype: 'badge-pending',
    obsolete: 'badge-cancelled',
    discontinued: 'badge-cancelled',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/products" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">{product.name}</h1>
              <Badge className={statusClass[product.status] ?? 'badge-pending'}>{product.status}</Badge>
            </div>
            <p className="font-mono text-sm text-[var(--muted-foreground)]">{product.code}</p>
            {product.category && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{product.category}</p>
            )}
            {product.description && (
              <p className="text-sm mt-2 text-[var(--foreground)]">{product.description}</p>
            )}
          </div>
          {isAdmin && (
            <Link href={`/products/${id}/edit`}>
              <Button size="sm" variant="outline"><Edit className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Variants Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Variants</h2>
          <span className="text-sm text-[var(--muted-foreground)]">{variants?.length ?? 0} variant(s)</span>
        </div>

        {isAdmin && (
          <AddVariantForm productId={id} />
        )}

        {(!variants || variants.length === 0) ? (
          <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-lg mt-4">
            <p className="text-[var(--muted-foreground)] text-sm">No variants yet. Add a variant above.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {variants.map(variant => (
              <div key={variant.id} className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--secondary)] border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-[var(--primary)]">{variant.code}</span>
                    <span className="font-medium text-sm">{variant.name}</span>
                    <Badge className={statusClass[variant.status] ?? 'badge-pending'}>{variant.status}</Badge>
                  </div>
                </div>

                {/* BOM for this variant */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Bill of Materials</h3>
                    <span className="text-xs text-[var(--muted-foreground)]">{variant.bill_of_materials?.length ?? 0} component(s)</span>
                  </div>

                  {variant.bill_of_materials && variant.bill_of_materials.length > 0 ? (
                    <Table className="mb-3">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variant.bill_of_materials.map((bom: {
                          id: string
                          quantity: number
                          unit: string | null
                          notes: string | null
                          component: { id: string; code: string; name: string; unit: string | null } | null
                        }) => (
                          <TableRow key={bom.id}>
                            <TableCell className="font-medium">{bom.component?.name ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">{bom.component?.code ?? '—'}</TableCell>
                            <TableCell>{bom.quantity}</TableCell>
                            <TableCell className="text-[var(--muted-foreground)]">{bom.unit ?? bom.component?.unit ?? '—'}</TableCell>
                            <TableCell className="text-[var(--muted-foreground)]">{bom.notes ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)] mb-3">No components in BOM yet.</p>
                  )}

                  {isAdmin && components && (
                    <BomManager variantId={variant.id} components={components} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
