-- Flower Quest days follow India time (IST, Asia/Kolkata) instead of UTC, so the daily play
-- limit resets at midnight in India rather than at 5:30 AM.
--
-- Same functions as before (20260308000000_flower_quest.sql and
-- 20261123090000_flower_quest_claim_counts_daily_limit.sql); only the day calculation changes.
-- Plays already counted today under the UTC day stay as they are.

CREATE OR REPLACE FUNCTION public.reserve_flower_quest_play(
  p_campaign_id uuid,
  p_subject_hash text,
  p_daily_limit integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.game_daily_limits (campaign_id, subject_hash, play_date, play_count)
  VALUES (p_campaign_id, p_subject_hash, (now() AT TIME ZONE 'Asia/Kolkata')::date, 1)
  ON CONFLICT (campaign_id, subject_hash, play_date)
  DO UPDATE SET play_count = game_daily_limits.play_count + 1
  WHERE game_daily_limits.play_count < p_daily_limit
  RETURNING play_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_flower_quest_reward(
  p_run_id uuid,
  p_user_id uuid
) RETURNS TABLE (coupon_code text, discount_percent integer, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.game_runs%ROWTYPE;
  v_campaign public.game_campaigns%ROWTYPE;
  v_percent integer;
  v_coupon public.discount_coupons%ROWTYPE;
  v_play_count integer;
BEGIN
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account was not found';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs
  WHERE id = p_run_id AND status = 'verified'
  FOR UPDATE;
  IF NOT FOUND OR (v_run.user_id IS NOT NULL AND v_run.user_id <> p_user_id) THEN
    RAISE EXCEPTION 'Verified game run was not found';
  END IF;

  SELECT * INTO v_campaign
  FROM public.game_campaigns
  WHERE id = v_run.campaign_id AND enabled = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reward campaign is not active';
  END IF;

  -- A guest run joins this account now, so it uses one of the account's plays for the day it was
  -- played. The subject hash matches the one the app uses: sha256 of 'user:<id>'.
  IF v_run.user_id IS NULL THEN
    INSERT INTO public.game_daily_limits (campaign_id, subject_hash, play_date, play_count)
    VALUES (
      v_campaign.id,
      encode(sha256(convert_to('user:' || p_user_id::text, 'UTF8')), 'hex'),
      (v_run.created_at AT TIME ZONE 'Asia/Kolkata')::date,
      1
    )
    ON CONFLICT (campaign_id, subject_hash, play_date)
    DO UPDATE SET play_count = game_daily_limits.play_count + 1
    WHERE game_daily_limits.play_count < v_campaign.max_plays_per_day
    RETURNING play_count INTO v_play_count;

    IF v_play_count IS NULL THEN
      RAISE EXCEPTION 'Daily play limit reached for this account';
    END IF;
  END IF;

  UPDATE public.game_runs SET user_id = p_user_id, guest_hash = NULL
  WHERE id = p_run_id;

  SELECT tiers.discount_percent INTO v_percent
  FROM public.game_reward_tiers AS tiers
  WHERE tiers.campaign_id = v_campaign.id
    AND tiers.minimum_score <= v_run.verified_score
  ORDER BY tiers.minimum_score DESC
  LIMIT 1;
  IF v_percent IS NULL THEN
    RAISE EXCEPTION 'No reward tier is configured for this score';
  END IF;

  SELECT * INTO v_coupon
  FROM public.discount_coupons
  WHERE user_id = p_user_id AND campaign_id = v_campaign.id
  FOR UPDATE;

  IF FOUND THEN
    IF v_coupon.status = 'available' AND v_percent > v_coupon.discount_percent THEN
      UPDATE public.discount_coupons
      SET discount_percent = v_percent, game_run_id = p_run_id
      WHERE id = v_coupon.id
      RETURNING * INTO v_coupon;
    END IF;
    RETURN QUERY SELECT v_coupon.code, v_coupon.discount_percent, v_coupon.expires_at;
    RETURN;
  END IF;

  INSERT INTO public.discount_coupons (
    campaign_id, game_run_id, user_id, code, discount_percent,
    minimum_order_value, maximum_discount_amount, expires_at
  ) VALUES (
    v_campaign.id, p_run_id, p_user_id,
    public.generate_flower_quest_coupon_code(),
    v_percent, v_campaign.minimum_order_value,
    v_campaign.maximum_discount_amount,
    now() + make_interval(days => v_campaign.coupon_expiry_days)
  )
  RETURNING * INTO v_coupon;

  RETURN QUERY SELECT v_coupon.code, v_coupon.discount_percent, v_coupon.expires_at;
END;
$$;
