import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function UsagePage() {
  const supabase = await createClient()

  const { data: transactions } = await supabase
    .from('inventory_transactions')
    .select(`
      id, quantity, reason, created_at,
      components ( code, name, unit )
    `)
    .eq('tx_type', 'usage')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Usage Report</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">History of components consumed from inventory</p>
        </div>
        <Link href="/usage/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Record Usage
          </Button>
        </Link>
      </div>

      {!transactions || transactions.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <p className="text-sm">No usage recorded yet.</p>
          <Link href="/usage/new">
            <Button variant="outline" className="mt-4">Record your first usage</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Date</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Component</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Qty Used</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => {
                const comp = t.components as any
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--muted)]/30'}`}
                  >
                    <td className="px-4 py-3 text-[var(--muted-foreground)] whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{comp?.name ?? '—'}</span>
                      {comp?.code && (
                        <span className="ml-1.5 font-mono text-xs text-[var(--muted-foreground)]">({comp.code})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {t.quantity} {comp?.unit ?? ''}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{t.reason ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
