import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/flower-quest/server'
import type { OrderCouponCheck } from '@/lib/flower-quest/coupon'
import { formatDateTimeIST, toDate } from '@/lib/datetime'

/**
 * WhatsApp orders and their Flower Quest coupons.
 *
 * Placing an order moves the coupon from 'available' to 'reserved', so no second order can use it.
 * Staff confirming the order (any status past 'pending') moves it to 'redeemed'; cancelling the
 * order makes it 'available' again. Coupons held by an online payment (a coupon_redemptions row)
 * are left to the payment flow.
 */

export type LinkedOrder = { id: string; ref: string; status: string; createdAt: string; total: number }

/**
 * The short order number shown to shoppers and staff, e.g. "K7M2QX". The database sets it on
 * insert (see the short_order_numbers migration).
 */
export const orderRef = (order: { id: string; order_number?: string | null }) =>
  order.order_number || order.id.slice(0, 8).toUpperCase()

const CONFIRMED_STATUSES = ['paid', 'processing', 'shipped', 'delivered']

/** The most recent order that is not cancelled and uses this coupon. */
export async function findActiveCouponOrder(supabase: SupabaseClient, couponId: string): Promise<LinkedOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, total')
    .eq('game_coupon_id', couponId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  return row
    ? { id: row.id, ref: orderRef(row), status: row.status ?? 'pending', createdAt: new Date(parseDbTime(row.created_at)).toISOString(), total: Number(row.total) }
    : null
}

/** True when the coupon is tied to an online payment, which manages the coupon itself. */
export async function hasOnlinePayment(supabase: SupabaseClient, couponId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId)
    .in('status', ['reserved', 'redeemed'])
  if (error) throw error
  return (count ?? 0) > 0
}

/** Call after staff change an order's status, so its coupon follows. */
export async function syncCouponWithOrder(supabase: SupabaseClient, orderId: string, status: string): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, game_coupon_id')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  const couponId: string | null = order?.game_coupon_id ?? null
  if (!couponId || await hasOnlinePayment(supabase, couponId)) return

  const active = await findActiveCouponOrder(supabase, couponId)
  const now = new Date().toISOString()

  if (status === 'cancelled') {
    // Free the coupon only when no other order still uses it.
    if (active) return
    const { error: freeError } = await supabase
      .from('discount_coupons')
      .update({ status: 'available', redeemed_at: null })
      .eq('id', couponId)
      .in('status', ['reserved', 'redeemed'])
      .gt('expires_at', now)
    if (freeError) throw freeError
    return
  }

  if (CONFIRMED_STATUSES.includes(status) && active?.id === orderId) {
    const { error: redeemError } = await supabase
      .from('discount_coupons')
      .update({ status: 'redeemed', redeemed_at: now })
      .eq('id', couponId)
      .in('status', ['available', 'reserved'])
    if (redeemError) throw redeemError
  }
}

/** orders.created_at is a timestamp without time zone, stored in UTC. */
export function parseDbTime(value: string): number {
  return toDate(value).getTime()
}

const formatIndia = (ms: number) =>
  formatDateTimeIST(ms)

const rupees = (paise: number) => {
  const value = paise / 100
  const fraction = paise % 100 !== 0
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: 2 })}`
}

/**
 * Checks an order's coupon against the order itself: whose it is, whether it was valid on the
 * order date, whether the order meets its minimum and the discount is right, and that no other
 * order uses it.
 */
export async function verifyOrderCoupon(supabase: SupabaseClient, orderId: string): Promise<OrderCouponCheck> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, user_id, status, created_at, subtotal, discount_amount, total, game_coupon_id, order_items(quantity, price)')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  if (!order) throw new ApiError('Order not found.', 404)
  if (!order.game_coupon_id) {
    return { hasCoupon: false, valid: true, summary: 'This order has no coupon.', coupon: null, checks: [] }
  }

  const { data: coupon, error: couponError } = await supabase
    .from('discount_coupons')
    .select('id, code, user_id, status, discount_percent, minimum_order_value, maximum_discount_amount, expires_at, created_at')
    .eq('id', order.game_coupon_id)
    .maybeSingle()
  if (couponError) throw couponError
  if (!coupon) {
    return {
      hasCoupon: true,
      valid: false,
      summary: 'The coupon on this order no longer exists.',
      coupon: null,
      checks: [{ key: 'exists', label: 'Coupon exists', ok: false, detail: 'No coupon matches this order.' }],
    }
  }

  const [{ data: others, error: othersError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('orders').select('id, order_number, status')
      .eq('game_coupon_id', coupon.id).neq('id', order.id).neq('status', 'cancelled'),
    supabase.from('coupon_redemptions').select('order_id, status')
      .eq('coupon_id', coupon.id).in('status', ['reserved', 'redeemed']),
  ])
  if (othersError) throw othersError
  if (paymentsError) throw paymentsError

  const orderedAt = parseDbTime(order.created_at)
  const expiresAt = Date.parse(coupon.expires_at)
  const issuedAt = Date.parse(coupon.created_at)
  const items = (order.order_items ?? []) as { quantity: number; price: number | string }[]
  const itemsPaise = items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0)
  const subtotalPaise = Math.round(Number(order.subtotal ?? order.total) * 100)
  const discountPaise = Math.round(Number(order.discount_amount ?? 0) * 100)
  const totalPaise = Math.round(Number(order.total) * 100)
  const minimumPaise = Math.round(Number(coupon.minimum_order_value) * 100)
  const expectedDiscount = Math.min(
    Math.round((subtotalPaise * coupon.discount_percent) / 100),
    Math.round(Number(coupon.maximum_discount_amount) * 100),
  )
  const otherPayments = (payments ?? []).filter(p => p.order_id !== order.id)
  const cancelled = order.status === 'cancelled'
  const confirmed = ['paid', 'processing', 'shipped', 'delivered'].includes(order.status ?? '')
  const expectedStatus = cancelled ? null : confirmed ? 'redeemed' : 'reserved'

  const checks: OrderCouponCheck['checks'] = [
    {
      key: 'owner',
      label: 'Belongs to this customer',
      ok: coupon.user_id === order.user_id,
      detail: coupon.user_id === order.user_id ? 'The coupon was issued to the account that placed this order.' : 'The coupon was issued to a different account.',
    },
    {
      key: 'issued',
      label: 'Issued before the order',
      ok: issuedAt <= orderedAt,
      detail: `Issued ${formatIndia(issuedAt)}; order placed ${formatIndia(orderedAt)}.`,
    },
    {
      key: 'expiry',
      label: 'Not expired on the order date',
      ok: expiresAt > orderedAt,
      detail: `Expires ${formatIndia(expiresAt)}.`,
    },
    {
      key: 'minimum',
      label: 'Meets the minimum order',
      ok: subtotalPaise >= minimumPaise,
      detail: `Order subtotal ${rupees(subtotalPaise)}; minimum ${rupees(minimumPaise)}.`,
    },
    {
      key: 'items',
      label: 'Items add up to the subtotal',
      ok: itemsPaise === subtotalPaise,
      detail: `Items ${rupees(itemsPaise)}; subtotal on the order ${rupees(subtotalPaise)}.`,
    },
    {
      key: 'discount',
      label: 'Discount is correct',
      ok: discountPaise === expectedDiscount && totalPaise === subtotalPaise - discountPaise,
      detail: `${coupon.discount_percent}% off, capped at ${rupees(Math.round(Number(coupon.maximum_discount_amount) * 100))}: expected −${rupees(expectedDiscount)}, order has −${rupees(discountPaise)} (total ${rupees(totalPaise)}).`,
    },
    {
      key: 'single',
      label: 'Not used on another order',
      ok: (others ?? []).length === 0 && otherPayments.length === 0,
      detail: (others ?? []).length > 0
        ? `Also on order ${(others ?? []).map(o => orderRef(o)).join(', ')}.`
        : otherPayments.length > 0 ? 'Also held by an online payment for another order.' : 'No other order uses this coupon.',
    },
    {
      key: 'status',
      label: 'Coupon status matches the order',
      ok: cancelled || coupon.status === expectedStatus || (expectedStatus === 'reserved' && coupon.status === 'redeemed'),
      detail: cancelled
        ? 'This order is cancelled, so the coupon is not applied to it.'
        : coupon.status === 'available'
          ? 'The coupon is not held for this order, so another order could take it. Change the order status to fix this.'
          : `Coupon is ${coupon.status}; order is ${order.status ?? 'pending'}.`,
    },
  ]

  const failed = checks.filter(check => !check.ok)
  const valid = !cancelled && failed.length === 0
  return {
    hasCoupon: true,
    valid,
    summary: cancelled
      ? 'This order is cancelled.'
      : valid ? 'Valid coupon for this order.' : `${failed.length} check${failed.length === 1 ? '' : 's'} failed.`,
    coupon: { code: coupon.code, status: coupon.status, discountPercent: coupon.discount_percent, expiresAt: coupon.expires_at },
    checks,
  }
}
