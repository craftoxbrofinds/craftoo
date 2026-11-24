import {
  ApiError,
  FLOWER_QUEST_CAMPAIGN,
  getOptionalUser,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'
import { findActiveCouponOrder } from '@/lib/flower-quest/coupon-orders'

/**
 * The signed-in player's Flower Quest coupon (each account has at most one), so the game's start
 * screen can show it again. Returns { coupon: null } when they haven't earned one.
 */
export async function GET(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to see your coupon.', 401)

    const supabase = getServiceClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('game_campaigns')
      .select('id')
      .eq('campaign_key', FLOWER_QUEST_CAMPAIGN)
      .maybeSingle()
    if (campaignError) throw campaignError
    if (!campaign) return Response.json({ coupon: null }, { headers: { 'Cache-Control': 'no-store' } })

    const { data: coupon, error } = await supabase
      .from('discount_coupons')
      .select('id, code, status, discount_percent, minimum_order_value, maximum_discount_amount, expires_at')
      .eq('user_id', user.id)
      .eq('campaign_id', campaign.id)
      .maybeSingle()
    if (error) throw error
    if (!coupon) return Response.json({ coupon: null }, { headers: { 'Cache-Control': 'no-store' } })

    const expired = coupon.status === 'expired' || (coupon.status === 'available' && Date.parse(coupon.expires_at) <= Date.now())
    const order = coupon.status === 'reserved' || coupon.status === 'redeemed' ? await findActiveCouponOrder(supabase, coupon.id) : null

    return Response.json({
      coupon: {
        code: coupon.code,
        discountPercent: coupon.discount_percent,
        expiresAt: coupon.expires_at,
        status: expired ? 'expired' : coupon.status,
        minimumOrderValue: Number(coupon.minimum_order_value),
        maximumDiscountAmount: Number(coupon.maximum_discount_amount),
        orderRef: order?.ref ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Flower Quest coupon lookup failed', 'Your coupon couldn’t be loaded just now.')
  }
}
