-- Flower Quest schema and payment hardening. Rewards remain disabled by default.
CREATE TABLE IF NOT EXISTS public.game_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key text NOT NULL UNIQUE,
  title text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  max_plays_per_day integer NOT NULL DEFAULT 8 CHECK (max_plays_per_day > 0),
  minimum_order_value numeric(10, 2) NOT NULL DEFAULT 599 CHECK (minimum_order_value >= 0),
  maximum_discount_amount numeric(10, 2) NOT NULL DEFAULT 500 CHECK (maximum_discount_amount >= 0),
  coupon_expiry_days integer NOT NULL DEFAULT 7 CHECK (coupon_expiry_days > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_reward_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.game_campaigns(id) ON DELETE CASCADE,
  minimum_score integer NOT NULL CHECK (minimum_score >= 0),
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 15),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, minimum_score)
);

CREATE TABLE IF NOT EXISTS public.game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.game_campaigns(id),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  guest_hash text,
  game_version text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'verified', 'invalid', 'expired')),
  verified_score integer CHECK (verified_score >= 0),
  elapsed_frames integer CHECK (elapsed_frames >= 0),
  input_replay jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK (user_id IS NULL OR guest_hash IS NULL)
);

CREATE INDEX IF NOT EXISTS game_runs_leaderboard_idx
  ON public.game_runs (campaign_id, completed_at DESC, verified_score DESC)
  WHERE status = 'verified' AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS game_runs_guest_day_idx
  ON public.game_runs (guest_hash, created_at DESC)
  WHERE guest_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.game_daily_limits (
  campaign_id uuid NOT NULL REFERENCES public.game_campaigns(id) ON DELETE CASCADE,
  subject_hash text NOT NULL,
  play_date date NOT NULL,
  play_count integer NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  PRIMARY KEY (campaign_id, subject_hash, play_date)
);

CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.game_campaigns(id),
  game_run_id uuid NOT NULL REFERENCES public.game_runs(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  code text NOT NULL UNIQUE,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 15),
  minimum_order_value numeric(10, 2) NOT NULL CHECK (minimum_order_value >= 0),
  maximum_discount_amount numeric(10, 2) NOT NULL CHECK (maximum_discount_amount >= 0),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'redeemed', 'expired')),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id),
  UNIQUE (game_run_id)
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.discount_coupons(id),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'redeemed', 'released')),
  reserved_until timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_one_live_coupon_idx
  ON public.coupon_redemptions (coupon_id)
  WHERE status IN ('reserved', 'redeemed');
CREATE INDEX IF NOT EXISTS discount_coupons_user_status_idx
  ON public.discount_coupons (user_id, status, expires_at);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_coupon_id uuid REFERENCES public.discount_coupons(id),
  ADD COLUMN IF NOT EXISTS razorpay_order_id text;

ALTER TABLE public.game_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_daily_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_campaigns_public_read ON public.game_campaigns;
CREATE POLICY game_campaigns_public_read ON public.game_campaigns
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS game_reward_tiers_public_read ON public.game_reward_tiers;
CREATE POLICY game_reward_tiers_public_read ON public.game_reward_tiers
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.game_campaigns c
      WHERE c.id = campaign_id AND c.enabled = true
    )
  );

REVOKE ALL ON public.game_runs, public.game_daily_limits, public.discount_coupons, public.coupon_redemptions
  FROM anon, authenticated;
GRANT SELECT ON public.game_campaigns, public.game_reward_tiers TO anon, authenticated;

DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_profile ON public.users;
REVOKE INSERT, UPDATE ON public.users FROM anon, authenticated;
REVOKE UPDATE (role) ON public.users FROM anon, authenticated;
GRANT UPDATE (name, email) ON public.users TO authenticated;
CREATE POLICY users_update_profile ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS orders_own ON public.orders;
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;

DROP POLICY IF EXISTS order_items_own ON public.order_items;
DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
GRANT SELECT ON public.order_items TO authenticated;

DROP POLICY IF EXISTS payments_own ON public.payments;
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

INSERT INTO public.game_campaigns (
  campaign_key, title, enabled, minimum_order_value, maximum_discount_amount, coupon_expiry_days
) VALUES (
  'flower-quest', 'Craftoo: The Flower Quest', false, 599, 500, 7
)
ON CONFLICT (campaign_key) DO NOTHING;

INSERT INTO public.game_reward_tiers (campaign_id, minimum_score, discount_percent)
SELECT id, tier.minimum_score, tier.discount_percent
FROM public.game_campaigns
CROSS JOIN (VALUES (0, 5), (201, 10), (351, 15)) AS tier(minimum_score, discount_percent)
WHERE campaign_key = 'flower-quest'
ON CONFLICT (campaign_id, minimum_score) DO NOTHING;

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
  VALUES (p_campaign_id, p_subject_hash, (now() AT TIME ZONE 'UTC')::date, 1)
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
    'FLOWER-' || upper(replace(gen_random_uuid()::text, '-', '')),
    v_percent, v_campaign.minimum_order_value,
    v_campaign.maximum_discount_amount,
    now() + make_interval(days => v_campaign.coupon_expiry_days)
  )
  RETURNING * INTO v_coupon;

  RETURN QUERY SELECT v_coupon.code, v_coupon.discount_percent, v_coupon.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_flower_quest_coupon(
  p_code text,
  p_user_id uuid,
  p_order_id uuid,
  p_subtotal numeric
) RETURNS TABLE (discount_amount numeric, final_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_coupon public.discount_coupons%ROWTYPE;
  v_discount numeric(10, 2);
BEGIN
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending order was not found';
  END IF;

  SELECT * INTO v_coupon
  FROM public.discount_coupons
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND OR v_coupon.user_id <> p_user_id OR v_coupon.status <> 'available'
    OR v_coupon.expires_at <= now() OR p_subtotal < v_coupon.minimum_order_value THEN
    RAISE EXCEPTION 'Coupon is invalid or not eligible for this order';
  END IF;

  v_discount := least(
    round(p_subtotal * v_coupon.discount_percent / 100, 2),
    v_coupon.maximum_discount_amount
  );

  INSERT INTO public.coupon_redemptions (coupon_id, order_id, user_id, reserved_until)
  VALUES (v_coupon.id, p_order_id, p_user_id, now() + interval '30 minutes');

  UPDATE public.discount_coupons SET status = 'reserved' WHERE id = v_coupon.id;
  UPDATE public.orders
  SET subtotal = p_subtotal, discount_amount = v_discount,
      total = p_subtotal - v_discount, game_coupon_id = v_coupon.id
  WHERE id = p_order_id;

  RETURN QUERY SELECT v_discount, p_subtotal - v_discount;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_flower_quest_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_redemption public.coupon_redemptions%ROWTYPE;
  v_item record;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id
    AND razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending payment order was not found';
  END IF;
  IF v_order.status = 'paid' AND v_order.payment_id = p_razorpay_payment_id THEN
    RETURN false;
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending payment order was not found';
  END IF;

  INSERT INTO public.payments (order_id, razorpay_order_id, razorpay_payment_id, status)
  VALUES (p_order_id, p_razorpay_order_id, p_razorpay_payment_id, 'captured');

  UPDATE public.orders
  SET status = 'paid', payment_id = p_razorpay_payment_id
  WHERE id = p_order_id;

  SELECT * INTO v_redemption
  FROM public.coupon_redemptions
  WHERE order_id = p_order_id AND status = 'reserved'
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.coupon_redemptions
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = v_redemption.id;
    UPDATE public.discount_coupons
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = v_redemption.coupon_id;
  ELSIF v_order.game_coupon_id IS NOT NULL THEN
    RAISE EXCEPTION 'Coupon reservation was not found';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock = CASE WHEN stock IS NULL THEN NULL ELSE greatest(stock - v_item.quantity, 0) END
    WHERE id = v_item.product_id;
  END LOOP;

  DELETE FROM public.cart_items ci
  USING public.carts c
  WHERE ci.cart_id = c.id AND c.user_id = p_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_flower_quest_coupon(
  p_order_id uuid,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_redemption public.coupon_redemptions%ROWTYPE;
BEGIN
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_redemption
  FROM public.coupon_redemptions
  WHERE order_id = p_order_id AND user_id = p_user_id AND status = 'reserved'
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.coupon_redemptions SET status = 'released' WHERE id = v_redemption.id;
    UPDATE public.discount_coupons
    SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'available' END
    WHERE id = v_redemption.coupon_id AND status = 'reserved';
  END IF;

  UPDATE public.orders SET status = 'cancelled'
  WHERE id = v_order_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_flower_quest_run(
  p_run_id uuid,
  p_score integer,
  p_elapsed_frames integer,
  p_input_replay jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  UPDATE public.game_runs
  SET status = 'verified',
      verified_score = p_score,
      elapsed_frames = p_elapsed_frames,
      input_replay = p_input_replay,
      completed_at = now()
  WHERE id = p_run_id
    AND status = 'started'
    AND expires_at > now()
    AND p_elapsed_frames > 0
    AND created_at <= now() - make_interval(
      secs => greatest(p_elapsed_frames::double precision / 60.0 - 2.0, 0.0)
    )
  RETURNING id INTO v_run_id;

  RETURN v_run_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.flower_quest_weekly_leaderboard(
  p_campaign_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz
) RETURNS TABLE (user_id uuid, verified_score integer, completed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT best.user_id, best.verified_score, best.completed_at
  FROM (
    SELECT DISTINCT ON (r.user_id)
      r.user_id, r.verified_score, r.completed_at
    FROM public.game_runs r
    WHERE r.campaign_id = p_campaign_id
      AND r.status = 'verified'
      AND r.user_id IS NOT NULL
      AND r.completed_at >= p_week_start
      AND r.completed_at < p_week_end
    ORDER BY r.user_id, r.verified_score DESC, r.completed_at ASC
  ) AS best
  ORDER BY best.verified_score DESC, best.completed_at ASC
  LIMIT 20
$$;

REVOKE ALL ON FUNCTION public.reserve_flower_quest_play(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_flower_quest_reward(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_flower_quest_coupon(text, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_flower_quest_payment(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_flower_quest_coupon(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_flower_quest_run(uuid, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flower_quest_weekly_leaderboard(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_flower_quest_play(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_flower_quest_reward(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_flower_quest_coupon(text, uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_flower_quest_payment(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_flower_quest_coupon(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_flower_quest_run(uuid, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.flower_quest_weekly_leaderboard(uuid, timestamptz, timestamptz) TO service_role;
