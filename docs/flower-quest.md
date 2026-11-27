# Craftoo: The Flower Quest

## Architecture

The `/play` route is a client-side experience. The homepage only renders a small link to it; Phaser is dynamically imported after a player starts. Starting a run is limited in the interface to devices reporting touch points and a coarse primary pointer, and gameplay uses on-screen touch controls rather than keyboard input. Phaser 3.90 renders the scene, while [`lib/flower-quest/simulation.ts`](../lib/flower-quest/simulation.ts) owns the fixed-step rules shared by the browser and server. The server replays the submitted input sequence before accepting a score, so Phaser and its physics engine are not part of the trust boundary.

Any change to `simulation.ts` that can change a run's outcome must bump `GAME_VERSION`, because the server rejects replays recorded with a different version. Version `flower-quest-v3` changed collision order (landing is resolved before walls, and ground segments now have solid sides) and moved the first checkpoint off the thorn patch at x=3500. Runs started on v2 before a deploy will fail verification and need to be replayed. `npm run test:game` includes a solver that checks the level can still be completed and that its replay verifies.

The SVG artwork in `public/games/` was created for this experience. Game state is reset when a run starts; the server stores the verified replay and score for the weekly leaderboard.

## Setup

1. Apply `supabase/migrations/20260308000000_flower_quest.sql` and verify the resulting schema, grants, RLS policies, and RPC functions.
2. The base migration leaves the campaign disabled. Apply `supabase/migrations/20261120234500_enable_flower_quest_rewards.sql` only when staff are ready to validate WhatsApp coupon requests and mark accepted codes redeemed manually.
3. Apply `supabase/migrations/20261121085500_fix_flower_quest_coupon_claim.sql`, then `supabase/migrations/20261122120000_short_flower_quest_coupon_codes.sql`. The last one makes new coupon codes 10 characters long (`FQ` + 8 characters, without look-alike characters such as 0/O and 1/I/L). Codes issued before it keep their longer format and still work. To shorten unused coupons that were already issued, run `supabase/scripts/shorten_existing_coupon_codes.sql` once in the SQL editor after the migration (reserved and redeemed coupons keep their codes). Then apply `supabase/migrations/20261123090000_flower_quest_claim_counts_daily_limit.sql`, which makes a guest run claimed by an account count against that account's daily plays.
4. Set `GAME_SESSION_SECRET` to a random secret with at least 32 characters. Keep it server-only.
5. Configure the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables. The service-role key must remain server-only.
6. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only when validating the separate Razorpay order/payment APIs.
7. Run `npm run test:game` for the simulation and coupon tests.

## Data model

- `game_campaigns` owns campaign windows and play/reward limits.
- `game_reward_tiers` defines score-to-discount thresholds for a campaign.
- `game_runs` records a started run and its server-verified replay/score. It references a campaign and, for signed-in runs, a user.
- `game_daily_limits` counts starts by a hashed account or signed guest identity per UTC day.
- `discount_coupons` belongs to one user and campaign and may reference the verified run that earned it.
- `coupon_redemptions` reserves a coupon for one order, then marks it redeemed or released.
- `orders` gains subtotal, discount, coupon, and Razorpay order fields.

The campaign seed is disabled. Do not enable it until the checkout experience accepts and validates these coupons end to end.

## API

- `GET /api/game/config` — public campaign and reward-tier settings.
- `POST /api/game/runs` — creates a signed run token and applies the daily play limit.
- `POST /api/game/runs/:id/complete` — validates a replay and records a score once.
- `POST /api/game/rewards/claim` — claims a coupon for a verified score and signed-in user.
- `GET /api/game/leaderboard` — returns the top 20 pseudonymous scores for the current UTC week.
- `POST /api/coupons/validate` — checks a coupon for the signed-in shopper against their server-side cart and returns the estimated discount and total. It does not reserve or redeem the coupon.
- `POST /api/orders/whatsapp` — records a WhatsApp order in `orders` and `order_items` (status `pending`) from the server-side cart just before WhatsApp opens. It refuses a coupon already on an order that isn't cancelled, and reuses the pending order when exactly the same order (items, gift extras and delivery details) is sent again within 24 hours. A different address or different gift extras makes a new order.
- `GET /api/admin/coupons?code=` — admin only. Returns the coupon's status, its owner, the order that uses it, and an estimate against the owner's current cart.
- `PATCH /api/admin/coupons` — admin only. `{ code, action: 'redeem' }` marks an available or held coupon redeemed; `{ code, action: 'restore' }` makes a coupon usable again when no order uses it.
- `POST /api/checkout` — creates a Razorpay order using server-side cart prices and may reserve a coupon.
- `POST /api/payments/verify` — validates the provider signature and captured payment before transactional order finalization.

The current checkout page uses WhatsApp rather than the Razorpay API. When a shopper applies a Flower Quest code, the page checks it with `/api/coupons/validate` and shows an estimated discount and total (products only, not delivery). The WhatsApp message carries the code, the estimated discount and total, and asks the team to verify the coupon and send the final bill. When the shopper taps "Send on WhatsApp", `POST /api/orders/whatsapp` saves the order in the `orders` table and the message carries its 6-character order number (`orders.order_number`, e.g. `K7M2QX`, set by the database on insert; see `supabase/migrations/20261124100000_short_order_numbers.sql`). If the cart changed since the review, nothing is saved and the shopper sees the new total first. A coupon on the order moves to `reserved`, so it can't go on a second order; sending exactly the same order again (same items, gift extras and delivery details) reuses the pending order instead of creating a duplicate, and the confirmation tells the shopper so. The same items for a different address are a new order.

Each order item also saves the gift extras the shopper ticked (`order_items.gift_extras`, see `supabase/migrations/20261124110000_order_item_gift_extras.sql`). On **Admin → Orders**, each order with a coupon has a **Verify** button (`GET /api/admin/orders/:id/verify-coupon`). It checks that the coupon belongs to the customer, was issued before and not expired on the order date, that the order meets the minimum and the discount is right, that no other order uses it, and that its status matches the order. Clicking an order number opens its detail page (`/admin/orders/:id`), which shows the products, any customization (with a button that opens WhatsApp to the customer with a message about it), the full delivery address, totals and the coupon check.

Staff track the order on **Admin → Orders**, and the customer sees the same status on `/orders`. Moving the order past `pending` (processing, shipped, delivered or paid) redeems its coupon; cancelling it makes the coupon `available` again. **Admin → Coupons** (`/admin/coupons`) looks up a code and shows its owner, its order and a cart estimate, and can redeem it by hand or restore one that no order uses.

## Future: online payment

The single-use note on the checkout page and in the game's coupon card is a stopgap while orders are confirmed by hand on WhatsApp. Both places are marked `TODO(payment-gateway)` in the code. When a payment gateway goes live:

1. Send checkout through `POST /api/checkout`, which reserves the coupon for that order with `reserve_flower_quest_coupon`.
2. Mark the coupon redeemed only when the bill is paid. `POST /api/payments/verify` already does this through `finalize_flower_quest_payment` after it confirms a captured payment.
3. Release the reservation with `release_flower_quest_coupon` when an order is abandoned or the payment fails for good, so the shopper can use the code again.
4. Remove the manual "verify my coupon" line from the WhatsApp message and update the single-use notes to describe the automatic behaviour.

## Security and operations

Run tokens are HMAC-signed and expire after 30 minutes. Replay validation, daily counters, coupon issuance, reservation, and payment finalization run on the server. Client-side writes to user roles, orders, order items, and payments are restricted by the schema and migration policies. Cart-item updates and deletes are scoped to the authenticated user's cart.

Replay verification prevents arbitrary score submission, but it does not prevent scripted play or sophisticated automation. Guest limits are tied to an HttpOnly signed cookie and can be evaded by clearing browser data; production campaigns may need additional rate limiting and abuse monitoring.

Daily limits hold across signing in and out. Plays started while signed in count against both the account and the browser's guest cookie, so signing out on the same browser does not give fresh plays. A guest run only earns a reward when an account claims it, and the claim counts that run against the account's plays for the day it was played; if the account had none left, the claim is refused and the score stays saved. A player can still play extra rounds as a guest in a private window, but those rounds cannot turn into a reward for an account that had used its plays.

Coupon reservations are deliberately not released just because a payment attempt failed: the provider order may still accept another attempt. For WhatsApp orders, holding the coupon is a conditional update (`available` → `reserved`), so two orders sent at the same moment cannot both use it. A shopper could still type a code by hand into a WhatsApp chat without using the site, so staff should match the order ref in the message to an order on the Orders page. No campaign admin UI, provider webhook reconciliation, or automatic abandoned-order cleanup is included yet.

## Validation and limitations

The simulation tests cover deterministic replay, collectible scoring, damage, jumping, input validation, and reward boundaries. The migration must still be exercised against a staging database, and payment flows must be tested with provider test credentials. Real-device, browser-matrix, production build, and checkout end-to-end testing remain release gates.
