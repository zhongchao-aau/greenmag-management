'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, CheckCircle, XCircle, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatQuantity } from '@/lib/utils'

function toLocalDate(d: Date) {
  return d.toLocaleDateString('sv-SE')
}

type ShipmentItem = {
  id: string
  quantity_shipped: number
  component: { id: string; code: string; name: string; unit: string } | null
}

type ExistingReceiptItem = {
  id: string
  quantity_received: number
  component: { id: string } | null
}

type ExistingInspectionItem = {
  id: string
  quantity_accepted: number
  quantity_rejected: number
  result: string
  notes: string | null
  component: { id: string } | null
}

type ExistingReceipt = {
  id: string
  received_at: string
  notes: string | null
  receipt_items: ExistingReceiptItem[]
  inspections: {
    id: string
    overall_result: string
    inspected_at: string
    notes: string | null
    items: ExistingInspectionItem[]
  }[]
}

type RowState = {
  component_id: string
  quantity_received: string
  quantity_accepted: string
}

type Props = {
  shipmentId: string
  shipmentItems: ShipmentItem[]
  receipt: ExistingReceipt | null
  isAdmin: boolean
}

function computeResult(received: number, accepted: number): 'pass' | 'fail' | 'partial' {
  if (accepted <= 0) return 'fail'
  if (accepted >= received) return 'pass'
  return 'partial'
}

function computeOverall(results: string[]): string {
  if (results.every(r => r === 'pass')) return 'pass'
  if (results.every(r => r === 'fail')) return 'fail'
  return 'partial'
}

function ResultBadge({ result }: { result: string }) {
  if (result === 'pass') return <Badge className="badge-approved text-xs">Pass</Badge>
  if (result === 'fail') return <Badge className="badge-cancelled text-xs">Fail</Badge>
  return <Badge className="badge-under-review text-xs">Partial</Badge>
}

export function ReceivingForm({ shipmentId, shipmentItems, receipt, isAdmin }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const inspection = receipt?.inspections?.[0] ?? null

  // In view mode when receipt exists, show read-only summary with Edit button
  const [editing, setEditing] = useState(!receipt)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build initial row state from existing receipt or empty
  const buildInitialRows = (): RowState[] => {
    // Use shipment items as the source of truth for which components to show
    const validItems = shipmentItems.filter(i => i.component)
    if (!receipt || !inspection) {
      return validItems.map(i => ({
        component_id: i.component!.id,
        quantity_received: '',
        quantity_accepted: '',
      }))
    }
    // Pre-fill from existing receipt + inspection
    return validItems.map(i => {
      const ri = receipt.receipt_items.find(r => r.component?.id === i.component!.id)
      const ii = inspection.items.find(x => x.component?.id === i.component!.id)
      return {
        component_id: i.component!.id,
        quantity_received: ri ? String(ri.quantity_received) : '',
        quantity_accepted: ii ? String(ii.quantity_accepted) : '',
      }
    })
  }

  const [rows, setRows] = useState<RowState[]>(buildInitialRows)
  const [date, setDate] = useState(
    receipt ? receipt.received_at.slice(0, 10) : toLocalDate(new Date())
  )
  const [notes, setNotes] = useState(receipt?.notes ?? '')

  function setRow(idx: number, patch: Partial<RowState>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate
    for (const [i, row] of rows.entries()) {
      const comp = shipmentItems[i]?.component
      if (!comp) continue
      const recv = parseFloat(row.quantity_received)
      const acc = parseFloat(row.quantity_accepted)
      if (!row.quantity_received || isNaN(recv) || recv < 0) {
        setError(`Row ${i + 1} (${comp.name}): received quantity required.`)
        return
      }
      if (!row.quantity_accepted || isNaN(acc) || acc < 0) {
        setError(`Row ${i + 1} (${comp.name}): accepted quantity required.`)
        return
      }
      if (acc > recv) {
        setError(`Row ${i + 1} (${comp.name}): accepted cannot exceed received.`)
        return
      }
    }

    setSubmitting(true)

    const validRows = rows.filter((_, i) => shipmentItems[i]?.component)
    const parsedRows = validRows.map((row, i) => ({
      component_id: row.component_id,
      quantity_received: parseFloat(row.quantity_received),
      quantity_accepted: parseFloat(row.quantity_accepted),
      quantity_rejected: parseFloat(row.quantity_received) - parseFloat(row.quantity_accepted),
      result: computeResult(parseFloat(row.quantity_received), parseFloat(row.quantity_accepted)),
    }))

    const overallResult = computeOverall(parsedRows.map(r => r.result))

    if (!receipt) {
      // --- CREATE ---
      const { data: newReceipt, error: receiptErr } = await supabase
        .from('receipts')
        .insert({ shipment_id: shipmentId, received_at: date, notes: notes || null })
        .select('id')
        .single()
      if (receiptErr || !newReceipt) { setError(receiptErr?.message ?? 'Failed to create receipt'); setSubmitting(false); return }

      const { error: riErr } = await supabase.from('receipt_items').insert(
        parsedRows.map(r => ({ receipt_id: newReceipt.id, component_id: r.component_id, quantity_received: r.quantity_received }))
      )
      if (riErr) { setError(riErr.message); setSubmitting(false); return }

      const { data: newInsp, error: inspErr } = await supabase
        .from('inspections')
        .insert({ receipt_id: newReceipt.id, overall_result: overallResult, inspected_at: date, notes: notes || null })
        .select('id')
        .single()
      if (inspErr || !newInsp) { setError(inspErr?.message ?? 'Failed to create inspection'); setSubmitting(false); return }

      const { error: iiErr } = await supabase.from('inspection_items').insert(
        parsedRows.map(r => ({
          inspection_id: newInsp.id,
          component_id: r.component_id,
          quantity_inspected: r.quantity_received,
          quantity_accepted: r.quantity_accepted,
          quantity_rejected: r.quantity_rejected,
          result: r.result,
        }))
      )
      if (iiErr) { setError(iiErr.message); setSubmitting(false); return }

      // Inventory transactions for accepted quantities
      const txRows = parsedRows
        .filter(r => r.quantity_accepted > 0)
        .map(r => ({
          component_id: r.component_id,
          transaction_type: 'receipt',
          quantity: r.quantity_accepted,
          notes: `Receipt ${newReceipt.id}`,
        }))
      if (txRows.length > 0) {
        const { error: txErr } = await supabase.from('inventory_transactions').insert(txRows)
        if (txErr) { setError(txErr.message); setSubmitting(false); return }
      }

    } else {
      // --- EDIT: update existing receipt + inspection ---
      const { error: receiptErr } = await supabase
        .from('receipts')
        .update({ received_at: date, notes: notes || null })
        .eq('id', receipt.id)
      if (receiptErr) { setError(receiptErr.message); setSubmitting(false); return }

      // Update receipt_items (upsert by component)
      for (const r of parsedRows) {
        const existing = receipt.receipt_items.find(x => x.component?.id === r.component_id)
        if (existing) {
          await supabase.from('receipt_items').update({ quantity_received: r.quantity_received }).eq('id', existing.id)
        } else {
          await supabase.from('receipt_items').insert({ receipt_id: receipt.id, component_id: r.component_id, quantity_received: r.quantity_received })
        }
      }

      if (inspection) {
        // Update inspection
        const { error: inspErr } = await supabase
          .from('inspections')
          .update({ overall_result: overallResult, inspected_at: date })
          .eq('id', inspection.id)
        if (inspErr) { setError(inspErr.message); setSubmitting(false); return }

        // Update inspection_items and create adjustment inventory transactions
        for (const r of parsedRows) {
          const existingII = inspection.items.find(x => x.component?.id === r.component_id)
          const oldAccepted = existingII?.quantity_accepted ?? 0
          const delta = r.quantity_accepted - oldAccepted

          if (existingII) {
            await supabase.from('inspection_items').update({
              quantity_inspected: r.quantity_received,
              quantity_accepted: r.quantity_accepted,
              quantity_rejected: r.quantity_rejected,
              result: r.result,
            }).eq('id', existingII.id)
          } else {
            await supabase.from('inspection_items').insert({
              inspection_id: inspection.id,
              component_id: r.component_id,
              quantity_inspected: r.quantity_received,
              quantity_accepted: r.quantity_accepted,
              quantity_rejected: r.quantity_rejected,
              result: r.result,
            })
          }

          // Inventory adjustment for delta
          if (delta !== 0) {
            await supabase.from('inventory_transactions').insert({
              component_id: r.component_id,
              transaction_type: 'receipt_adjustment',
              quantity: delta,
              notes: `Adjustment for receipt ${receipt.id}`,
            })
          }
        }
      }
    }

    setEditing(false)
    router.refresh()
    setSubmitting(false)
  }

  // ---- READ-ONLY VIEW ----
  if (!editing && receipt && inspection) {
    const items = inspection.items ?? []
    const totalAccepted = items.reduce((s, i) => s + (i.quantity_accepted ?? 0), 0)
    const totalRejected = items.reduce((s, i) => s + (i.quantity_rejected ?? 0), 0)

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-500" />
              Receiving &amp; Inspection
            </CardTitle>
            <div className="flex items-center gap-2">
              <ResultBadge result={inspection.overall_result} />
              {isAdmin && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                >
                  <Pencil className="w-3 h-3" />Edit
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">Received {new Date(receipt.received_at).toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-700">{formatQuantity(totalAccepted)}</p>
              <p className="text-xs text-green-600 mt-0.5">Into Inventory</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-red-700">{formatQuantity(totalRejected)}</p>
              <p className="text-xs text-red-600 mt-0.5">Rejected</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-gray-900">
                {items.filter(i => i.result === 'pass').length}/{items.length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Items Passed</p>
            </div>
          </div>

          {/* Per-item table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left text-xs text-[var(--muted-foreground)] font-medium pb-2">Component</th>
                  <th className="text-right text-xs text-[var(--muted-foreground)] font-medium pb-2">Ordered</th>
                  <th className="text-right text-xs text-[var(--muted-foreground)] font-medium pb-2">Received</th>
                  <th className="text-right text-xs text-green-600 font-medium pb-2">Accepted</th>
                  <th className="text-right text-xs text-red-600 font-medium pb-2">Rejected</th>
                  <th className="text-right text-xs text-[var(--muted-foreground)] font-medium pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {shipmentItems.filter(si => si.component).map(si => {
                  const ri = receipt.receipt_items.find(r => r.component?.id === si.component!.id)
                  const ii = items.find(x => x.component?.id === si.component!.id)
                  return (
                    <tr key={si.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2">
                        <p className="font-medium">{si.component!.name}</p>
                        <p className="text-xs font-mono text-[var(--muted-foreground)]">{si.component!.code}</p>
                      </td>
                      <td className="py-2 text-right text-[var(--muted-foreground)]">
                        {formatQuantity(si.quantity_shipped, si.component!.unit)}
                      </td>
                      <td className="py-2 text-right">
                        {ri ? formatQuantity(ri.quantity_received, si.component!.unit) : 'â'}
                      </td>
                      <td className="py-2 text-right">
                        {ii ? (
                          <span className="flex items-center justify-end gap-1 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            {formatQuantity(ii.quantity_accepted, si.component!.unit)}
                          </span>
                        ) : 'â'}
                      </td>
                      <td className="py-2 text-right">
                        {ii && ii.quantity_rejected > 0 ? (
                          <span className="flex items-center justify-end gap-1 text-red-700">
                            <XCircle className="w-3 h-3" />
                            {formatQuantity(ii.quantity_rejected, si.component!.unit)}
                          </span>
                        ) : 'â'}
                      </td>
                      <td className="py-2 text-right">
                        {ii && <ResultBadge result={ii.result} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {receipt.notes && (
            <p className="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-1.5 rounded">{receipt.notes}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // ---- EDIT / CREATE FORM ----
  return (
    <Card className={receipt ? 'border-indigo-200' : 'border-green-200 bg-green-50/30'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-indigo-500" />
          {receipt ? 'Edit Receiving Record' : 'Record Receiving & Inspection'}
        </CardTitle>
        <p className="text-xs text-[var(--muted-foreground)]">
          Enter how many units were received and how many passed inspection (can go to inventory).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Date Received</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--background)]"
              />
            </div>
          </div>

          {/* Per-component table */}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--secondary)]">
                <tr>
                  <th className="text-left text-xs text-[var(--muted-foreground)] font-medium px-3 py-2">Component</th>
                  <th className="text-right text-xs text-[var(--muted-foreground)] font-medium px-3 py-2">Ordered</th>
                  <th className="text-right text-xs text-[var(--muted-foreground)] font-medium px-3 py-2 min-w-[110px]">Received</th>
                  <th className="text-right text-xs text-green-600 font-medium px-3 py-2 min-w-[110px]">Accepted âÂ Stock</th>
                  <th className="text-right text-xs text-red-600 font-medium px-3 py-2">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {shipmentItems.filter(si => si.component).map((si, idx) => {
                  const row = rows[idx]
                  if (!row) return null
                  const recv = parseFloat(row.quantity_received) || 0
                  const acc = parseFloat(row.quantity_accepted) || 0
                  const rejected = Math.max(0, recv - acc)
                  return (
                    <tr key={si.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">
                        <p className="font-medium">{si.component!.name}</p>
                        <p className="text-xs font-mono text-[var(--muted-foreground)]">{si.component!.code}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--muted-foreground)] whitespace-nowrap">
                        {formatQuantity(si.quantity_shipped, si.component!.unit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity_received}
                            onChange={e => {
                              setRow(idx, { quantity_received: e.target.value })
                              // Auto-fill accepted if not yet typed
                              if (!row.quantity_accepted) {
                                setRow(idx, { quantity_received: e.target.value, quantity_accepted: e.target.value })
                              }
                            }}
                            placeholder="0"
                            className="w-20 border border-[var(--border)] rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--background)]"
                          />
                          <span className="text-xs text-[var(--muted-foreground)]">{si.component!.unit}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            max={recv || undefined}
                            value={row.quantity_accepted}
                            onChange={e => setRow(idx, { quantity_accepted: e.target.value })}
                            placeholder="0"
                            className="w-20 border border-green-300 rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-green-500 focus:border-transparent bg-green-50"
                          />
                          <span className="text-xs text-[var(--muted-foreground)]">{si.component!.unit}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 whitespace-nowrap">
                        {recv > 0 && rejected > 0 ? formatQuantity(rejected, si.component!.unit) : 'â'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Condition of package, discrepancies, etc."
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-[var(--background)]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex gap-3 justify-end">
            {receipt && (
              <button
                type="button"
                onClick={() => { setEditing(false); setRows(buildInitialRows()) }}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Savingâ¦' : receipt ? 'Update Record' : 'Save Receiving Record'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
