/**
 * POST /api/tracking/refresh
 * Refreshes tracking status for one or all eu_transit shipments.
 * Auto-tracking only runs for shipments in eu_transit — China leg
 * has too many carriers without a standard API, so it is updated manually.
 *
 * Body (JSON):
 *   { shipmentId?: string }   — refresh a single shipment; omit to refresh all eu_transit
 *
 * Auth: requires valid Supabase session (admin only) or service role key.
 *
 * Returns:
 *   { updated: number, errors: Array<{id, code, error}> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { fetchTracking } from '@/lib/tracking'

export const dynamic = 'force-dynamic'
export const maxDuration = 30  // Vercel function timeout

export async function POST(req: NextRequest) {
  // Auth: accept user session OR service role key (for cron)
  const cronServiceKey = req.headers.get('x-cron-service-key')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any

  if (cronServiceKey && serviceRoleKey && cronServiceKey === serviceRoleKey) {
    supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
  } else {
    supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { shipmentId } = body as { shipmentId?: string }

  // Only refresh eu_transit shipments — EU carrier APIs are supported
  let query = supabase
    .from('shipments')
    .select('id, code, eu_carrier, eu_tracking_number, status')
    .eq('status', 'eu_transit')

  if (shipmentId) {
    // Allow refreshing a specific shipment regardless of status
    query = supabase
      .from('shipments')
      .select('id, code, eu_carrier, eu_tracking_number, status')
      .eq('id', shipmentId)
  }

  const { data: shipments, error: fetchErr } = await query
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const results: Array<{ id: string; code: string; updated: boolean; status?: string; error?: string }> = []

  for (const shp of shipments ?? []) {
    const trackingNumber = shp.eu_tracking_number
    const carrier = shp.eu_carrier

    if (!trackingNumber) {
      results.push({ id: shp.id, code: shp.code, updated: false, error: 'No EU tracking number' })
      continue
    }

    try {
      const tracking = await fetchTracking(trackingNumber.trim(), carrier?.toLowerCase())

      // Update shipment row
      const update: Record<string, unknown> = {
        eu_status: tracking.statusDetail,
        updated_at: new Date().toISOString(),
      }

      // Promote status: eu_transit → delivered (auto), handle exception flag
      if (tracking.status === 'delivered' && shp.status === 'eu_transit') {
        update.status = 'delivered'
        // Set actual_delivery from the most recent delivered event
        const deliveredEvent = tracking.events.find(e => e.description.toLowerCase().includes('deliver'))
        if (deliveredEvent?.date) update.actual_delivery = deliveredEvent.date
      } else if (tracking.isException) {
        // Flag exception but keep the current status — admin will review
        update.has_exception = true
        update.exception_notes = tracking.statusDetail
      }

      if (tracking.estimatedDelivery) {
        update.expected_delivery = tracking.estimatedDelivery
      }

      const { error: updateErr } = await supabase
        .from('shipments')
        .update(update)
        .eq('id', shp.id)
      if (updateErr) throw new Error(updateErr.message)

      // Insert new shipment events (upsert to avoid duplicates)
      for (const event of tracking.events) {
        if (!event.date || !event.description) continue
        await supabase.from('shipment_events').upsert(
          {
            shipment_id: shp.id,
            tracking_leg: 'eu',
            event_date: event.date,
            location: event.location,
            description: event.description,
          },
          { ignoreDuplicates: true, onConflict: 'shipment_id,event_date,description' }
        )
      }

      results.push({ id: shp.id, code: shp.code, updated: true, status: (update.status as string) ?? shp.status })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ id: shp.id, code: shp.code, updated: false, error: msg })
    }
  }

  const updated = results.filter(r => r.updated).length
  const errors = results.filter(r => !r.updated && r.error !== 'No EU tracking number')

  return NextResponse.json({ updated, errors, results })
}
