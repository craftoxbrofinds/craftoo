import {
  ApiError,
  getGameSecret,
  getOptionalUser,
  getServiceClient,
  handleApiError,
  verifyRunToken,
} from '@/lib/flower-quest/server'

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to claim your reward', 401)

    const body = await req.json() as { runId?: unknown; token?: unknown }
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) {
      throw new ApiError('Invalid game session', 400)
    }

    const supabase = getServiceClient()
    const { data: run, error: runError } = await supabase
      .from('game_runs')
      .select('id, status, expires_at, user_id')
      .eq('id', body.runId)
      .maybeSingle()
    if (runError) throw runError
    if (!run || run.status !== 'verified') throw new ApiError('Verified game result was not found', 404)
    if (run.user_id && run.user_id !== user.id) throw new ApiError('This game result belongs to another account', 403)
    if (!verifyRunToken(run.id, body.token, run.expires_at, getGameSecret())) {
      throw new ApiError('Reward claim has expired', 401)
    }

    const { data, error } = await supabase.rpc('claim_flower_quest_reward', {
      p_run_id: run.id,
      p_user_id: user.id,
    })
    if (error) {
      if (error.message.includes('campaign is not active')) {
        throw new ApiError('Rewards are not active yet. Your verified score is saved.', 409)
      }
      if (error.message.includes('No reward tier')) {
        throw new ApiError('This score is not eligible for a reward', 409)
      }
      if (error.message.includes('Daily play limit reached')) {
        throw new ApiError(
          'Your account had already used all of that day’s plays, so this round can’t earn a reward. Your score is still saved.',
          409,
        )
      }
      throw error
    }

    const reward = Array.isArray(data) ? data[0] : data
    if (!reward) throw new Error('Reward claim returned no coupon')
    // Each account has one coupon per campaign, so a repeat claim can return one already used.
    const { data: coupon } = await supabase
      .from('discount_coupons')
      .select('status')
      .eq('code', reward.coupon_code)
      .maybeSingle()
    return Response.json({
      code: reward.coupon_code,
      discountPercent: reward.discount_percent,
      expiresAt: reward.expires_at,
      status: coupon?.status ?? 'available',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Flower Quest reward claim failed', 'The game service could not complete this request')
  }
}
