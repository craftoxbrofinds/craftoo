-- Customer profile: the contact details and the one delivery address used at checkout.
-- They are filled in from the checkout form when an order is placed, and can be edited on
-- /profile. Writes go through the app's API (service role); customers can't write these
-- columns directly.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS delivery_address text;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_phone_check CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_contact_email_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_contact_email_check CHECK (contact_email IS NULL OR char_length(contact_email) <= 254);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_delivery_address_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_delivery_address_check CHECK (delivery_address IS NULL OR char_length(delivery_address) <= 2000);
