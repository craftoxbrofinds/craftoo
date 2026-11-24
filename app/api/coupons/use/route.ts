import {
  ApiError,
  getOptionalUser,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'
import { COUPON_CODE_PATTERN, normalizeCouponCode, quoteCoupon } from '@/lib/flower-quest/coupon'
import { getCartSubtotal, loadCoupon } from '@/lib/flower-quest/coupon-server'

/**
 * Marks a Flower Quest coupon as used when the shopper sends their order on WhatsApp, so the same
 * code cannot be used for another order. The coupon is checked again against the server-side
 * cart first, and the update only succeeds while the coupon is still available, so two orders
 * sent at the same moment cannot both use it.
 *
 * TODO(payment-gateway): once online payment is live, reserve the coupon at checkout instead and
 * mark it redeemed only when the bill is paid (see "Future: online payment" in docs/flower-quest.md).
 * Staff can make a coupon usable again by setting its status back to 'available' in Supabase.
 */
export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to use a coupon', 401)

    const body = await req.json().catch(() => ({})) as { code?: unknown }
    const code = normalizeCouponCode(body.code)
    if (!COUPON_CODE_PATTERN.test(code)) {
      throw new ApiError('Enter a valid coupon code. It uses letters, numbers and dashes only.', 400)
    }

    const supabase = getServiceClient()
    const subtotal = await getCartSubtotal(supabase, user.id)
    const result = quoteCoupon(await loadCoupon(supabase, code), user.id, subtotal)
    if (!result.ok) {
      return Response.json({ error: result.error.message, reason: result.error.reason }, {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const { data: used, error } = await supabase
      .from('discount_coupons')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .eq('user_id', user.id)
      .eq('status', 'available')
      .gt('expires_at', new Date().toISOString())
      .select('code')
    if (error) throw error
    if (!used || used.length === 0) {
      return Response.json({ error: 'This coupon has already been used.', reason: 'used' }, {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return Response.json(result.quote, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Coupon could not be marked as used')
  }
}
