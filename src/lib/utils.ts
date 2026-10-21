import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import type { RequestStatus, OrderStatus, ShipmentStatus, InspectionResult } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatQuantity(qty: number | null | undefined, unit = 'pcs'): string {
  if (qty == null) return '—'
  return `${qty} ${unit}`
}

export function formatCurrency(amount: number | null | undefined, currency = 'DKK'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency }).format(amount)
}

// Status label maps
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  draft: 'Draft',
  changes_requested: 'Changes Requested',
  rejected: 'Rejected',
  closed: 'Closed',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  approved: 'Approved',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partially_shipped: 'Partially Shipped',
  shipped: 'Shipped',
  partially_received: 'Partially Received',
  received: 'Received',
  closed: 'Closed',
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  created: 'Created',
  china_dispatched: 'China Dispatched',
  cn_transit: 'CN Transit',
  customs: 'Customs',
  on_hold: 'On Hold',
  eu_transit: 'EU Transit',
  delivered: 'Delivered',
  received: 'Received',
  complete: 'Complete',
  // Legacy values kept for backward compat
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  exception: 'Exception',
  returned: 'Returned',
}

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  pending: 'Pending',
  passed: 'Passed',
  partially_passed: 'Partially Passed',
  failed: 'Failed',
}

// Status → CSS class suffix
export function requestStatusClass(status: RequestStatus): string {
  const map: Record<RequestStatus, string> = {
    draft: 'badge-draft',
    submitted: 'badge-submitted',
    under_review: 'badge-review',
    approved: 'badge-approved',
    changes_requested: 'badge-changes',
    rejected: 'badge-rejected',
    closed: 'badge-closed',
  }
  return map[status] ?? 'badge-draft'
}

export function orderStatusClass(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    approved: 'badge-approved',
    ordered: 'badge-ordered',
    confirmed: 'badge-confirmed',
    partially_shipped: 'badge-submitted',
    shipped: 'badge-shipped',
    partially_received: 'badge-review',
    received: 'badge-delivered',
    closed: 'badge-closed',
  }
  return map[status] ?? 'badge-draft'
}

export function shipmentStatusClass(status: ShipmentStatus): string {
  const map: Record<ShipmentStatus, string> = {
    created: 'badge-draft',
    china_dispatched: 'badge-submitted',
    cn_transit: 'badge-ordered',
    customs: 'badge-review',
    on_hold: 'badge-review',
    eu_transit: 'badge-shipped',
    delivered: 'badge-delivered',
    received: 'badge-approved',
    complete: 'badge-closed',
    // Legacy
    dispatched: 'badge-submitted',
    in_transit: 'badge-ordered',
    out_for_delivery: 'badge-shipped',
    exception: 'badge-rejected',
    returned: 'badge-changes',
  }
  return map[status] ?? 'badge-draft'
}

export function inspectionResultClass(result: InspectionResult): string {
  const map: Record<InspectionResult, string> = {
    pending: 'badge-pending',
    passed: 'badge-passed',
    partially_passed: 'badge-review',
    failed: 'badge-failed',
  }
  return map[result] ?? 'badge-pending'
}

export function truncate(str: string | null | undefined, len = 60): string {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}
