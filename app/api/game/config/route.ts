import {
  ApiError,
  FLOWER_QUEST_CAMPAIGN,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'

export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data: campaign, error } = await supabase
      .from('game_campaigns')
      .select('id, enabled, starts_at, ends_at, max_plays_per_day, minimum_order_value, maximum_discount_amount, coupon_expiry_days')
      .eq('campaign_key', FLOWER_QUEST_CAMPAIGN)
      .single()
    if (error || !campaign) throw new ApiError('Game campaign is not configured', 503)

    const { data: tiers, error: tierError } = await supabase
      .from('game_reward_tiers')
      .select('minimum_score, discount_percent')
      .eq('campaign_id', campaign.id)
      .order('minimum_score', { ascending: true })
    if (tierError) throw tierError

    const now = Date.now()
    const active = campaign.enabled &&
      (!campaign.starts_at || Date.parse(campaign.starts_at) <= now) &&
      (!campaign.ends_at || Date.parse(campaign.ends_at) > now)

    return Response.json({
      enabled: active,
      minimumOrderValue: campaign.minimum_order_value,
      maximumDiscountAmount: campaign.maximum_discount_amount,
      couponExpiryDays: campaign.coupon_expiry_days,
      rewardTiers: tiers ?? [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Flower Quest config failed', 'The game service could not complete this request')
  }
}
