-- Photos the shopper uploaded for the "Your photo" gift extra, saved with each order item so staff
-- can see them on the admin order page (up to 5 per item).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS gift_photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_gift_photos_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_gift_photos_check
  CHECK (cardinality(gift_photos) <= 5);
