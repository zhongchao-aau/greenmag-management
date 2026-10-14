import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Factory } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const { data: products } = await supabase
    .from('products')
    .select(`
      id, code, name, category, status, created_at,
      product_variants(count)
    `)
    .order('created_at', { ascending: false })

  const isAdmin = profile?.role === 'admin'

  const statusClass: Record<string, string> = {
    active: 'badge-approved',
    prototype: 'badge-pending',
    obsolete: 'badge-cancelled',
    discontinued: 'badge-cancelled',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{(products ?? []).length} products</p>
        </div>
        {isAdmin && (
          <Link href="/products/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Product</Button>
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={<Factory className="w-8 h-8 text-[var(--muted-foreground)]" />}
                    title="No products yet"
                    description={isAdmin ? 'Create your first product to start managing production.' : 'No products have been added yet.'}
                    action={isAdmin ? <Link href="/products/new"><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Product</Button></Link> : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (products ?? []).map((p: {
                id: string; code: string; name: string; category: string | null;
                status: string; created_at: string;
                product_variants: { count: number }[] | null
              }) => {
                const variantCount = Array.isArray(p.product_variants)
                  ? p.product_variants[0]?.count ?? 0
                  : 0
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">{p.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/products/${p.id}`} className="hover:text-[var(--primary)]">{p.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">{p.category ?? '—'}</TableCell>
                    <TableCell className="text-sm">{variantCount}</TableCell>
                    <TableCell>
                      <Badge className={statusClass[p.status] ?? 'badge-pending'}>{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
