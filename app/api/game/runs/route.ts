import {
  ApiError,
  FLOWER_QUEST_CAMPAIGN,
  createGuestCookie,
  createGuestId,
  createRunToken,
  createSubjectHash,
  getGameSecret,
  getGuestId,
  getOptionalUser,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'
import { GAME_VERSION } from '@/lib/flower-quest/simulation'

export async function POST(req: Request) {
  try {
    const secret = getGameSecret()
    const user = await getOptionalUser(req)
    const supabase = getServiceClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('game_campaigns')
      .select('id, enabled, starts_at, ends_at, max_plays_per_day')
      .eq('campaign_key', FLOWER_QUEST_CAMPAIGN)
      .single()
    if (campaignError || !campaign) throw new ApiError('Game campaign is not configured', 503)

    // Every browser gets a signed guest id, even when signed in, so plays made while signed in also
    // count for this browser: signing out does not hand out a fresh set of plays.
    const existingGuestId = getGuestId(req, secret)
    const guestId = existingGuestId ?? createGuestId()
    const guestHash = createSubjectHash(`guest:${guestId}`)
    const subjectHash = user ? createSubjectHash(`user:${user.id}`) : guestHash
    const { data: allowed, error: limitError } = await supabase.rpc('reserve_flower_quest_play', {
      p_campaign_id: campaign.id,
      p_subject_hash: subjectHash,
      p_daily_limit: campaign.max_plays_per_day,
    })
    if (limitError) throw limitError
    if (!allowed) throw new ApiError('You have reached today’s play limit. Come back tomorrow.', 429)
    if (user) {
      // Record the play against this browser too. The account's own limit was checked above, so
      // this always counts (a shared device should not block a signed-in player's own plays).
      const { error: browserError } = await supabase.rpc('reserve_flower_quest_play', {
        p_campaign_id: campaign.id,
        p_subject_hash: guestHash,
        p_daily_limit: 2147483647,
      })
      if (browserError) throw browserError
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60
    const { data: run, error: runError } = await supabase
      .from('game_runs')
      .insert({
        campaign_id: campaign.id,
        user_id: user?.id ?? null,
        guest_hash: user ? null : subjectHash,
        game_version: GAME_VERSION,
        expires_at: new Date(expiresAt * 1000).toISOString(),
      })
      .select('id')
      .single()
    if (runError || !run) throw runError ?? new Error('Could not create game run')

    const headers = new Headers({ 'Cache-Control': 'no-store' })
    if (!existingGuestId) headers.set('Set-Cookie', createGuestCookie(guestId, secret))
    const now = Date.now()
    const campaignEnabled = campaign.enabled &&
      (!campaign.starts_at || Date.parse(campaign.starts_at) <= now) &&
      (!campaign.ends_at || Date.parse(campaign.ends_at) > now)
    return Response.json({
      runId: run.id,
      token: createRunToken(run.id, expiresAt, secret),
      expiresAt,
      campaignEnabled,
    }, { headers })
  } catch (error) {
    return handleApiError(error, 'Flower Quest run creation failed', 'The game service could not complete this request')
  }
}
