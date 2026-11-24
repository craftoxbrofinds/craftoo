import { isAdmin } from '@/lib/auth'
import { ApiError, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import {
  COUPON_CODE_PATTERN,
  normalizeCouponCode,
  quoteCoupon,
  type CouponQuote,
  type StaffCouponLookup,
  type StaffCouponState,
} from '@/lib/flower-quest/coupon'
import { getCartSummary } from '@/lib/flower-quest/coupon-server'
import { findActiveCouponOrder, hasOnlinePayment, type LinkedOrder } from '@/lib/flower-quest/coupon-orders'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Staff coupon desk. Placing a WhatsApp order holds its coupon ('reserved'); staff look the code
 * up here and see the order it is on. The coupon is redeemed when staff confirm that order, either
 * here or by moving the order past 'pending' on the Orders page.
 *
 * GET   /api/admin/coupons?code=FQ...           → coupon, owner, linked order, cart estimate
 * PATCH /api/admin/coupons { code, action }     → action 'redeem' or 'restore'
 */

type CouponRow = {
  id: string
  code: string
  user_id: string
  status: string
  discount_percent: number
  minimum_order_value: number | string
  maximum_discount_amount: number | string
  expires_at: string
  redeemed_at: string | null
  created_at: string
}

const noStore = { 'Cache-Control': 'no-store' }

function readCode(value: unknown): string {
  const code = normalizeCouponCode(value)
  if (!COUPON_CODE_PATTERN.test(code)) {
    throw new ApiError('Enter a valid coupon code. It uses letters, numbers and dashes only.', 400)
  }
  return code
}

async function loadRow(supabase: SupabaseClient, code: string): Promise<CouponRow> {
  const { data, error } = await supabase
    .from('discount_coupons')
    .select('id, code, user_id, status, discount_percent, minimum_order_value, maximum_discount_amount, expires_at, redeemed_at, created_at')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError('No coupon has this code.', 404)
  return data as CouponRow
}

function stateOf(row: CouponRow, now = Date.now()): StaffCouponState {
  if (row.status === 'redeemed') return 'redeemed'
  if (row.status === 'reserved') return 'reserved'
  if (row.status !== 'available' || Date.parse(row.expires_at) <= now) return 'expired'
  return 'available'
}

function messageFor(state: StaffCouponState, order: LinkedOrder | null, onlinePayment: boolean): string {
  if (state === 'available') return 'Valid. No order uses this coupon yet.'
  if (state === 'expired') return 'Expired. This coupon can no longer be used.'
  if (order) {
    return state === 'reserved'
      ? `Order ${order.ref} was placed with this coupon and is waiting for confirmation. Don’t accept it on any other order.`
      : `Redeemed on order ${order.ref}. Don’t accept it on any other order.`
  }
  if (onlinePayment) return 'Held by an online payment. Don’t accept it on a WhatsApp order.'
  return state === 'reserved'
    ? 'Held, but no order uses it. You can make it usable again.'
    : 'Already redeemed. Don’t accept it on another order.'
}

async function lookup(supabase: SupabaseClient, code: string): Promise<StaffCouponLookup> {
  const row = await loadRow(supabase, code)
  const state = stateOf(row)

  const [{ data: owner, error: ownerError }, cart, order, onlinePayment] = await Promise.all([
    supabase.from('users').select('id, name, email').eq('id', row.user_id).maybeSingle(),
    getCartSummary(supabase, row.user_id),
    findActiveCouponOrder(supabase, row.id),
    hasOnlinePayment(supabase, row.id),
  ])
  if (ownerError) throw ownerError

  // The estimate uses the owner's own saved cart, the same figures the shopper saw at checkout.
  let estimate: CouponQuote | null = null
  let note: string | null = null
  if (cart.lines.length === 0) {
    note = 'The customer’s cart is empty right now. Check the items in their WhatsApp message.'
  } else if (state !== 'available') {
    note = order
      ? 'The coupon is already on an order, so this cart gets no discount from it.'
      : 'No discount: the coupon cannot be used.'
  } else {
    const quote = quoteCoupon(row, row.user_id, cart.subtotal)
    if (quote.ok) estimate = quote.quote
    else note = quote.error.message
  }

  return {
    coupon: {
      code: row.code,
      status: row.status,
      state,
      discountPercent: row.discount_percent,
      minimumOrderValue: Number(row.minimum_order_value),
      maximumDiscountAmount: Number(row.maximum_discount_amount),
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
    },
    owner: { id: row.user_id, name: owner?.name ?? null, email: owner?.email ?? null },
    order: order && { ref: order.ref, status: order.status, createdAt: order.createdAt, total: order.total },
    usable: state === 'available',
    canRedeem: (state === 'available' || state === 'reserved') && !onlinePayment,
    canRestore: (state === 'reserved' || state === 'redeemed') && !order && !onlinePayment && Date.parse(row.expires_at) > Date.now(),
    message: messageFor(state, order, onlinePayment),
    cart: { ...cart, estimate, note },
  }
}

export async function GET(req: Request) {
  try {
    if (!(await isAdmin(req))) throw new ApiError('Unauthorized', 401)
    const code = readCode(new URL(req.url).searchParams.get('code'))
    return Response.json(await lookup(getServiceClient(), code), { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Admin coupon lookup failed', 'The coupon could not be looked up. Please try again.')
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAdmin(req))) throw new ApiError('Unauthorized', 401)
    const body = await req.json().catch(() => ({})) as { code?: unknown; action?: unknown }
    const code = readCode(body.code)
    if (body.action !== 'redeem' && body.action !== 'restore') throw new ApiError('Unknown action.', 400)

    const supabase = getServiceClient()
    const now = new Date().toISOString()

    if (body.action === 'redeem') {
      // Only an available or held coupon changes, so two staff members can't redeem it twice.
      const row = await loadRow(supabase, code)
      if (await hasOnlinePayment(supabase, row.id)) {
        throw new ApiError('This coupon is held by an online payment, which redeems it when paid.', 409)
      }
      const { data, error } = await supabase
        .from('discount_coupons')
        .update({ status: 'redeemed', redeemed_at: now })
        .eq('id', row.id)
        .in('status', ['available', 'reserved'])
        .gt('expires_at', now)
        .select('code')
      if (error) throw error
      if (!data || data.length === 0) {
        const current = await lookup(supabase, code)
        return Response.json({ error: `Not redeemed. ${current.message}`, lookup: current }, { status: 409, headers: noStore })
      }
    } else {
      // Make the coupon usable again. While an order still uses it, staff cancel that order on the
      // Orders page instead, which frees the coupon. A coupon paid for online stays with its payment.
      const row = await loadRow(supabase, code)
      if (await hasOnlinePayment(supabase, row.id)) {
        throw new ApiError('This coupon was used for an online payment, so it can’t be restored here.', 409)
      }
      const order = await findActiveCouponOrder(supabase, row.id)
      if (order) {
        throw new ApiError(`Order ${order.ref} still uses this coupon. Cancel that order on the Orders page to free the coupon.`, 409)
      }

      const { data, error } = await supabase
        .from('discount_coupons')
        .update({ status: 'available', redeemed_at: null })
        .eq('id', row.id)
        .in('status', ['reserved', 'redeemed'])
        .gt('expires_at', now)
        .select('code')
      if (error) throw error
      if (!data || data.length === 0) {
        const current = await lookup(supabase, code)
        const reason = current.coupon.state === 'expired' ? 'It has expired.' : 'It is not in use.'
        return Response.json({ error: `Not restored. ${reason}`, lookup: current }, { status: 409, headers: noStore })
      }
    }

    return Response.json(await lookup(supabase, code), { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Admin coupon update failed', 'The coupon could not be updated. Please try again.')
  }
}
