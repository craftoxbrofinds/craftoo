-- Short order numbers: 6 characters with at least one letter and one digit (e.g. K7M2QX).
-- They come from the same 31-character alphabet as coupon codes, without look-alikes
-- (no 0/O, 1/I/L), so they are easy to read out over WhatsApp. That gives roughly 880 million
-- combinations. orders.id stays the primary key; order_number is what shoppers and staff see.

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_attempt integer;
  v_byte integer;
BEGIN
  FOR v_attempt IN 1..20 LOOP
    -- gen_random_uuid() is cryptographically random. Bytes 6 and 8 carry the UUID version and
    -- variant bits, so only fully random bytes are used.
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    FOREACH v_byte IN ARRAY ARRAY[0, 1, 2, 3, 4, 5] LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_byte) % length(v_alphabet)) + 1, 1);
    END LOOP;
    -- Always a mix of letters and digits.
    CONTINUE WHEN v_code !~ '[A-Z]' OR v_code !~ '[0-9]';
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a unique order number';
END;
$$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text;

-- Give existing orders a number too.
DO $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN SELECT id FROM public.orders WHERE order_number IS NULL ORDER BY created_at LOOP
    UPDATE public.orders SET order_number = public.generate_order_number() WHERE id = v_order.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);

-- New orders get a number automatically, whichever route creates them.
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_order_number ON public.orders;
CREATE TRIGGER orders_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;
