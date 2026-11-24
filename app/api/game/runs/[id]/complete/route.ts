import {
  ApiError,
  getGameSecret,
  getServiceClient,
  handleApiError,
  verifyRunToken,
} from '@/lib/flower-quest/server'
import { GAME_VERSION, MAX_RUN_FRAMES, replayInputs } from '@/lib/flower-quest/simulation'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new ApiError('Invalid game session', 400)
    const body = await req.json() as { token?: unknown; replay?: unknown }
    if (!Array.isArray(body.replay) || body.replay.length > MAX_RUN_FRAMES * 2) {
      throw new ApiError('Invalid game replay', 400)
    }

    const supabase = getServiceClient()
    const { data: run, error: runError } = await supabase
      .from('game_runs')
      .select('id, status, expires_at, game_version, created_at, game_campaigns(enabled, starts_at, ends_at)')
      .eq('id', id)
      .maybeSingle()
    if (runError) throw runError
    if (!run) throw new ApiError('Game session was not found', 404)
    if (run.status !== 'started') throw new ApiError('This game session has already been submitted', 409)
    if (run.game_version !== GAME_VERSION) throw new ApiError('This game version is no longer supported', 400)
    if (!verifyRunToken(id, body.token, run.expires_at, getGameSecret())) {
      throw new ApiError('Game session is invalid or has expired', 401)
    }

    let result
    try {
      result = replayInputs(body.replay as number[])
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Invalid game replay', 400)
    }
    if (result.status !== 'won' || result.tick < 1) {
      throw new ApiError('This run did not finish the level', 400)
    }

    const { data: saved, error: saveError } = await supabase.rpc('complete_flower_quest_run', {
      p_run_id: id,
      p_score: result.score,
      p_elapsed_frames: result.tick,
      p_input_replay: body.replay,
    })
    if (saveError) throw saveError
    if (!saved) throw new ApiError('This game session has expired or was already submitted', 409)

    const campaign = Array.isArray(run.game_campaigns) ? run.game_campaigns[0] : run.game_campaigns
    const now = Date.now()
    const campaignEnabled = Boolean(campaign?.enabled) &&
      (!campaign?.starts_at || Date.parse(campaign.starts_at) <= now) &&
      (!campaign?.ends_at || Date.parse(campaign.ends_at) > now)

    return Response.json({
      verified: true,
      score: result.score,
      elapsedFrames: result.tick,
      flowers: result.flowers.filter(Boolean).length,
      campaignEnabled,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Flower Quest run verification failed', 'The game service could not complete this request')
  }
}
