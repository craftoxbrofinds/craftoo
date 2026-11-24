-- OPTIONAL, run once by hand in the Supabase SQL editor, AFTER applying
-- migrations/20261122120000_short_flower_quest_coupon_codes.sql.
--
-- Gives every unused Flower Quest coupon that still has an old long code (FLOWER-…) a new
-- 10-character code (FQ + 8 characters). Coupons that are reserved or redeemed keep their codes,
-- so existing orders still match.
--
-- Note: anyone who saved an old long code will need the new one. They see it again by claiming
-- their reward in the game (it returns their existing coupon), or your team can look it up here.

BEGIN;

UPDATE public.discount_coupons
SET code = public.generate_flower_quest_coupon_code()
WHERE status = 'available'
  AND length(code) > 10;

-- Review the result before committing: every available coupon should now be 10 characters.
SELECT status, length(code) AS code_length, count(*) AS coupons
FROM public.discount_coupons
GROUP BY status, length(code)
ORDER BY status, code_length;

COMMIT;
