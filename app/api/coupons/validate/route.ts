import {
  ApiError,
  getOptionalUser,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'
import { COUPON_CODE_PATTERN, normalizeCouponCode, quoteCoupon } from '@/lib/flower-quest/coupon'
import { getCartSubtotal, loadCoupon } from '@/lib/flower-quest/coupon-server'

/**
 * Checks a Flower Quest coupon against the signed-in shopper's own cart and returns the
 * discounted total. Prices come from the server-side cart, never from the browser.
 * This only quotes the discount. Staff mark the coupon redeemed from /admin/coupons when they
 * confirm the WhatsApp order.
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
    return Response.json(result.quote, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Coupon validation failed')
  }
}
