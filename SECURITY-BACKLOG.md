# Security Backlog

These items came from the database/payment review. Repository-level mitigations are implemented; items remain open until the migration and authorization behavior are verified against a staging Supabase project.

## Critical

- [x] **Prevent self-assignment of admin role**
  - **Implemented:** Client updates are limited to `name` and `email`; `role` updates are explicitly revoked in `supabase/schema.sql` and the Flower Quest migration.
  - **Verify:** Attempt role changes using an authenticated customer token and confirm they are denied.
  - **Verified 2026-11-27:** `supabase/scripts/verify_security_backlog.sql` passed (`role` not updatable by `anon`/`authenticated`, no insert, own-row update policy only) on the deployed project.

## High

- [x] **Enforce cart-item ownership on mutations**
  - **Implemented:** `repositories/cart.repo.ts` scopes item reads, updates, and deletes to the cart ID loaded for the authenticated user in `services/cart.service.ts`. Mutations also report missing/non-owned items and reject invalid or over-stock quantities.
  - **Verify:** Attempt to mutate another account's cart item through both cart API methods.
  - **Status 2026-11-27:** DB policy scopes `cart_items` to `auth.uid()` (PASS). The API uses the service role, so the code-level scoping is what protects it; the two-account API test has not been run.
  - **Verified 2026-11-27:** `services/cart.service.test.ts` (`npm run test:cart`) changes, zeroes and removes another account's item through the service with an RLS-free client and confirms each is refused and the item is untouched. The tests fail when the `cart_id` filter is removed.

- [x] **Disallow direct client writes to orders and payments**
  - **Implemented:** `supabase/schema.sql` and the Flower Quest migration retain owner reads while revoking client insert, update, and delete privileges. Trusted server-side checkout and payment finalization use the service role.
  - **Verify:** Confirm the deployed grants and RLS policies deny direct client writes and preserve valid checkout/payment behavior.
  - **Verified 2026-11-27:** `supabase/scripts/verify_security_backlog.sql` passed (no client write grants or write policies on `orders`, `order_items`, `payments`, `order_charges`; payment RPCs are service-role only) on the deployed project. Still worth one real checkout to confirm the happy path.

## Medium

- [x] **Pin search_path on the signup trigger function**
  - **Implemented:** `handle_new_user()` is `SECURITY DEFINER`; `supabase/migrations/20261127090000_handle_new_user_search_path.sql` fixes its `search_path` to `public`.
  - **Verify:** Apply the migration and confirm a new signup still creates its `public.users` row.
  - **Verified 2026-11-27:** `supabase/scripts/verify_security_backlog.sql` passed (`handle_new_user()` has a fixed `search_path`) on the deployed project. Still confirm a new signup creates its `public.users` row.

- [ ] **Refuse hidden products in carts and WhatsApp orders**
  - **Implemented:** The cart API uses the service role, so RLS on `products` does not apply. `services/cart.service.ts` now refuses inactive products on add and quantity change, and `getCartSummary` in `lib/flower-quest/coupon-server.ts` refuses a WhatsApp order that contains one.
  - **Verify:** Hide a product in admin, then try adding it by ID and placing an order that already has it in the cart.
  - **Status 2026-11-27:** Cart add and quantity change are covered by `npm run test:cart`. The WhatsApp order check still needs one manual try.

## Deferred

- [ ] **Reject unverified mock payments** (deferred: Razorpay is not in use)
  - **Implemented:** `app/api/payments/verify/route.ts` requires a valid Razorpay HMAC signature, ownership of the local order, and a captured provider payment with matching order, amount, and currency. The mock-payment fallback was removed.
  - **Verify:** Exercise forged signatures, mismatched orders/amounts, and captured test payments in Razorpay test mode.
  - **Status 2026-11-27:** Finalization RPC is service-role only (PASS). The forged/mismatched payment tests through the API have not been run.
  - **Deferred 2026-11-27:** Checkout goes through WhatsApp; no page calls `/api/checkout` or `/api/payments/verify`. Both return 503 while `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are unset, so leave those unset in production. Run the verify tests before turning Razorpay on.

## Release gate

- [x] Run `supabase/scripts/verify_security_backlog.sql` in the SQL editor of the deployed project; every row must say PASS. All PASS on 2026-11-27.
- [ ] Apply `supabase/migrations/20260308000000_flower_quest.sql` to staging and test the policies, RPC permissions, coupon concurrency, and payment lifecycle before production.
