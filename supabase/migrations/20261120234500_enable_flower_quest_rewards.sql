DO $$
BEGIN
  UPDATE public.game_campaigns
  SET enabled = true
  WHERE campaign_key = 'flower-quest';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flower Quest campaign is missing; apply its base migration first';
  END IF;
END;
$$;
