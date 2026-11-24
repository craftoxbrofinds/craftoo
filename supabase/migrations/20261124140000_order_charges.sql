-- Extra charges staff add to an order after it is placed: delivery, photo prints (per photo),
-- customization, gift wrap and so on. Final bill = orders.total (products after coupon) + these.
-- Only the app's server (service role) reads or writes them; customers see them through the API.
CREATE TABLE IF NOT EXISTS public.order_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('shipping', 'photo', 'customization', 'chocolates', 'packaging', 'other')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  unit_amount numeric(10, 2) NOT NULL CHECK (unit_amount > 0 AND unit_amount <= 100000),
  amount numeric(12, 2) GENERATED ALWAYS AS (quantity * unit_amount) STORED,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_charges_order_idx ON public.order_charges (order_id, created_at);

ALTER TABLE public.order_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_charges FROM anon, authenticated;
