import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderCharge } from '@/lib/order-charges'
import { logger } from '@/lib/logger'

/**
 * Extra charges for the given orders, by order id. If the order_charges table doesn't exist
 * yet (migration not run), this logs a warning and returns no charges, so order pages still load.
 */
export async function loadOrderCharges(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, OrderCharge[]>> {
  const byOrder = new Map<string, OrderCharge[]>()
  if (orderIds.length === 0) return byOrder
  const { data, error } = await supabase
    .from('order_charges')
    .select('id, order_id, kind, label, quantity, unit_amount, amount, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true })
  if (error) {
    logger.warn('Order charges unavailable (has the order_charges migration run?)', { error })
    return byOrder
  }
  for (const row of data ?? []) {
    const { order_id, ...charge } = row as OrderCharge & { order_id: string }
    const list = byOrder.get(order_id) ?? []
    list.push({ ...charge, unit_amount: Number(charge.unit_amount), amount: Number(charge.amount) })
    byOrder.set(order_id, list)
  }
  return byOrder
}
