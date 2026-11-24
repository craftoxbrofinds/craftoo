import {
  ApiError,
  FLOWER_QUEST_CAMPAIGN,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'

/** India is UTC+5:30 all year (no daylight saving). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** Start of this week, Monday 00:00 in India time, as an exact instant. */
function mondayIndia(value: Date): Date {
  const india = new Date(value.getTime() + IST_OFFSET_MS) // India wall-clock time, read with UTC getters
  const offset = (india.getUTCDay() + 6) % 7
  const midnight = Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate() - offset)
  return new Date(midnight - IST_OFFSET_MS)
}

export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('game_campaigns')
      .select('id')
      .eq('campaign_key', FLOWER_QUEST_CAMPAIGN)
      .single()
    if (campaignError || !campaign) throw new ApiError('Game campaign is not configured', 503)

    const now = new Date()
    const weekStart = mondayIndia(now)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { data: runs, error } = await supabase.rpc('flower_quest_weekly_leaderboard', {
      p_campaign_id: campaign.id,
      p_week_start: weekStart.toISOString(),
      p_week_end: weekEnd.toISOString(),
    })
    if (error) throw error

    const leaderboardRuns: Array<{ user_id: string; verified_score: number; completed_at: string }> = runs ?? []
    const entries = leaderboardRuns.map((run, index) => ({
      rank: index + 1,
      displayName: `Garden friend ${run.user_id.slice(0, 4).toUpperCase()}`,
      score: run.verified_score,
      completedAt: run.completed_at,
    }))

    return Response.json({
      weekStartsAt: weekStart.toISOString(),
      weekEndsAt: weekEnd.toISOString(),
      entries,
    }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
  } catch (error) {
    return handleApiError(error, 'Flower Quest leaderboard failed', 'The game service could not complete this request')
  }
}
