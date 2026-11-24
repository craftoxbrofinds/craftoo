-- Gift extras (customization) the shopper ticked for each product, saved with the order so staff
-- can see them on the admin order page. Values: 'chocolates', 'photo'.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS gift_extras text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_gift_extras_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_gift_extras_check
  CHECK (gift_extras <@ ARRAY['chocolates', 'photo']::text[]);
