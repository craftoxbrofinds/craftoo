-- READ-ONLY. Run in the Supabase SQL editor of the project the app uses.
-- Checks the deployed grants, RLS and function permissions behind SECURITY-BACKLOG.md.
-- Every row should say PASS. It changes nothing.

WITH checks AS (
  -- 1. Customers cannot make themselves admin
  SELECT 'users.role not updatable by anon' AS check_name,
         NOT has_column_privilege('anon', 'public.users', 'role', 'UPDATE') AS ok
  UNION ALL
  SELECT 'users.role not updatable by authenticated',
         NOT has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE')
  UNION ALL
  SELECT 'users not insertable by anon/authenticated',
         NOT has_any_column_privilege('anon', 'public.users', 'INSERT')
     AND NOT has_any_column_privilege('authenticated', 'public.users', 'INSERT')
  UNION ALL
  SELECT 'users update policy is own-row only',
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'users'
                   AND policyname = 'users_update_profile')
     AND NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'users'
                       AND policyname IN ('users_update_own', 'users_insert_own'))

  -- 4. No direct client writes to orders, order_items, payments, order_charges
  UNION ALL
  SELECT format('%s not writable by %s', t, r),
         NOT has_any_column_privilege(r, format('public.%I', t), 'INSERT')
     AND NOT has_any_column_privilege(r, format('public.%I', t), 'UPDATE')
     AND NOT has_table_privilege(r, format('public.%I', t), 'DELETE')
  FROM unnest(ARRAY['orders', 'order_items', 'payments', 'order_charges']) AS t,
       unnest(ARRAY['anon', 'authenticated']) AS r
  WHERE to_regclass(format('public.%I', t)) IS NOT NULL
  UNION ALL
  SELECT format('no client write policy on %s', t),
         NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = t
                       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
  FROM unnest(ARRAY['orders', 'order_items', 'payments']) AS t
  UNION ALL
  SELECT 'order_charges not readable by clients',
         CASE WHEN to_regclass('public.order_charges') IS NULL THEN false
              ELSE NOT has_table_privilege('anon', 'public.order_charges', 'SELECT')
               AND NOT has_table_privilege('authenticated', 'public.order_charges', 'SELECT')
         END

  -- 3. Cart items are scoped to the owner's cart
  UNION ALL
  SELECT 'cart_items policy references carts.user_id = auth.uid()',
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'cart_items'
                   AND qual ILIKE '%auth.uid()%')

  -- RLS on every public table
  UNION ALL
  SELECT format('RLS enabled on %s', c.relname), c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'

  -- 2. Payment/game RPCs callable only by the server (service_role)
  UNION ALL
  SELECT format('%s not executable by %s', p.oid::regprocedure, r),
         NOT has_function_privilege(r, p.oid, 'EXECUTE')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
       unnest(ARRAY['anon', 'authenticated']) AS r
  WHERE n.nspname = 'public'
    AND p.proname IN ('reserve_flower_quest_play', 'claim_flower_quest_reward',
                      'reserve_flower_quest_coupon', 'finalize_flower_quest_payment',
                      'release_flower_quest_coupon', 'complete_flower_quest_run',
                      'flower_quest_weekly_leaderboard', 'generate_flower_quest_coupon_code',
                      'generate_order_number')

  -- SECURITY DEFINER functions pin their search_path
  UNION ALL
  SELECT format('%s has fixed search_path', p.oid::regprocedure),
         EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
                 WHERE cfg LIKE 'search_path=%')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef

  -- Release gate: Flower Quest migration objects exist
  UNION ALL
  SELECT format('table %s exists', t), to_regclass(format('public.%I', t)) IS NOT NULL
  FROM unnest(ARRAY['game_campaigns', 'game_runs', 'discount_coupons',
                    'coupon_redemptions', 'order_charges']) AS t
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, check_name
FROM checks
ORDER BY ok, check_name;
