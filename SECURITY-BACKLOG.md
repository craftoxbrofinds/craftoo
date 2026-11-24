# Security Backlog

These items came from the database/payment review. Repository-level mitigations are implemented; items remain open until the migration and authorization behavior are verified against a staging Supabase project.

## Critical

- [ ] **Prevent self-assignment of admin role**
  - **Implemented:** Client updates are limited to `name` and `email`; `role` updates are explicitly revoked in `supabase/schema.sql` and the Flower Quest migration.
  - **Verify:** Attempt role changes using an authenticated customer token and confirm they are denied.

## High

- [ ] **Reject unverified mock payments**
  - **Implemented:** `app/api/payments/verify/route.ts` requires a valid Razorpay HMAC signature, ownership of the local order, and a captured provider payment with matching order, amount, and currency. The mock-payment fallback was removed.
  - **Verify:** Exercise forged signatures, mismatched orders/amounts, and captured test payments in Razorpay test mode.

- [ ] **Enforce cart-item ownership on mutations**
  - **Implemented:** `repositories/cart.repo.ts` scopes item reads, updates, and deletes to the cart ID loaded for the authenticated user in `services/cart.service.ts`. Mutations also report missing/non-owned items and reject invalid or over-stock quantities.
  - **Verify:** Attempt to mutate another account's cart item through both cart API methods.

- [ ] **Disallow direct client writes to orders and payments**
  - **Implemented:** `supabase/schema.sql` and the Flower Quest migration retain owner reads while revoking client insert, update, and delete privileges. Trusted server-side checkout and payment finalization use the service role.
  - **Verify:** Confirm the deployed grants and RLS policies deny direct client writes and preserve valid checkout/payment behavior.

## Release gate

- [ ] Apply `supabase/migrations/20260308000000_flower_quest.sql` to staging and test the policies, RPC permissions, coupon concurrency, and payment lifecycle before production.
