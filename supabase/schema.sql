-- ============================================================
-- Craftoo Store Template — Full Schema
-- Run this in Supabase SQL Editor for every new store
-- ============================================================

-- Required extension for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. CATEGORIES  (no FK deps — must come before products)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  name        text        NOT NULL UNIQUE,
  slug        text        UNIQUE,
  image       text,
  sort_order  integer,
  is_active   boolean     DEFAULT true,
  count_label text,
  created_at  timestamp   DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);


-- ============================================================
-- 2. PRODUCTS  (FK → categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id             uuid      NOT NULL DEFAULT uuid_generate_v4(),
  name           text,
  price          numeric,
  original_price numeric,
  image          text,
  description    text,
  weight         text,
  stock          integer   DEFAULT 0,
  sort_order     integer,
  is_active      boolean   DEFAULT true,
  category       text,
  category_id    uuid,
  created_at     timestamp DEFAULT now(),
  CONSTRAINT products_pkey    PRIMARY KEY (id),
  CONSTRAINT fk_category      FOREIGN KEY (category_id) REFERENCES public.categories(id)
);


-- ============================================================
-- 3. USERS  (FK → auth.users which Supabase creates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid      NOT NULL,
  name       text,
  email      text,
  role       text      DEFAULT 'customer',
  created_at timestamp DEFAULT now(),
  CONSTRAINT users_pkey    PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);


-- ============================================================
-- 4. CARTS  (FK → users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.carts (
  id         uuid      NOT NULL DEFAULT uuid_generate_v4(),
  user_id    uuid      NOT NULL UNIQUE,
  created_at timestamp DEFAULT now(),
  CONSTRAINT carts_pkey        PRIMARY KEY (id),
  CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);


-- ============================================================
-- 5. CART ITEMS  (FK → carts, products)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id         uuid    NOT NULL DEFAULT uuid_generate_v4(),
  cart_id    uuid    NOT NULL,
  product_id uuid    NOT NULL,
  quantity   integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  CONSTRAINT cart_items_pkey           PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey   FOREIGN KEY (cart_id)    REFERENCES public.carts(id)    ON DELETE CASCADE,
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);


-- ============================================================
-- 6. ORDERS  (FK → users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id         uuid      NOT NULL DEFAULT uuid_generate_v4(),
  user_id    uuid      NOT NULL,
  total      numeric   NOT NULL,
  status     text      DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','paid','processing','shipped','delivered','cancelled'])),
  payment_id text,
  address    text,
  created_at timestamp DEFAULT now(),
  CONSTRAINT orders_pkey        PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);


-- ============================================================
-- 7. ORDER ITEMS  (FK → orders, products)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id         uuid    NOT NULL DEFAULT uuid_generate_v4(),
  order_id   uuid    NOT NULL,
  product_id uuid    NOT NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  price      numeric NOT NULL,
  CONSTRAINT order_items_pkey            PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey   FOREIGN KEY (order_id)   REFERENCES public.orders(id)   ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);


-- ============================================================
-- 8. PAYMENTS  (FK → orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid      NOT NULL DEFAULT uuid_generate_v4(),
  order_id            uuid      UNIQUE,
  razorpay_order_id   text,
  razorpay_payment_id text,
  status              text,
  created_at          timestamp DEFAULT now(),
  CONSTRAINT payments_pkey          PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);


-- ============================================================
-- 9. SITE SETTINGS  (no FK deps — admin customization)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  key   text  NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT site_settings_pkey PRIMARY KEY (key)
);

-- Default values — admin will update these via /admin/settings
INSERT INTO public.site_settings (key, value) VALUES
  ('brand', '{
    "name":        "Craftoo",
    "tagline":     "",
    "site_url":    "",
    "favicon_url": "/favicon.ico"
  }'),
  ('contact', '{
    "phone":    "",
    "whatsapp": "",
    "email":    "",
    "address":  "",
    "hours":    ""
  }'),
  ('social', '{
    "instagram": "",
    "facebook":  "",
    "youtube":   ""
  }'),
  ('announcement', '{
    "enabled":  true,
    "messages": [
      "✦ Free Shipping on Orders of ₹1,000 and Above",
      "✦ Easy 7-Day Returns — No Questions Asked",
      "✦ Secure Payments · UPI · Cards · Wallets"
    ]
  }'),
  ('seo', '{
    "title":       "Craftoo",
    "description": "Shop online — free shipping and easy returns.",
    "og_image":    ""
  }'),
  ('hero', '{
    "desktop": [],
    "mobile":  []
  }')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 10. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('products',   'products',   true),
  ('categories', 'categories', true),
  ('hero',       'hero',       true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- Enable RLS so users can only see their own data
-- ============================================================

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments    ENABLE ROW LEVEL SECURITY;
-- Products, categories, site_settings are public read
ALTER TABLE public.products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own row
CREATE POLICY "users_select_own"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_profile" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
REVOKE INSERT, UPDATE ON public.users FROM anon, authenticated;
REVOKE UPDATE (role) ON public.users FROM anon, authenticated;
GRANT UPDATE (name, email) ON public.users TO authenticated;

-- Carts: own cart only
CREATE POLICY "carts_own" ON public.carts FOR ALL USING (
  user_id = auth.uid()
);

-- Cart items: via cart ownership
CREATE POLICY "cart_items_own" ON public.cart_items FOR ALL USING (
  cart_id IN (SELECT id FROM public.carts WHERE user_id = auth.uid())
);

-- Orders: own orders only
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;

-- Order items: via order ownership
CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
GRANT SELECT ON public.order_items TO authenticated;

-- Payments: via order ownership
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
  )
);
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Products: everyone can read active products
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (is_active = true);

-- Categories: everyone can read active categories
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (is_active = true);

-- Site settings: everyone can read (brand name, contact, etc.)
CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT USING (true);


-- ============================================================
-- 12. AUTO-CREATE USER ROW ON SIGNUP
-- Trigger: when someone signs up via Supabase Auth,
-- automatically insert a row into public.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
