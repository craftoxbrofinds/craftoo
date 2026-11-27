# Deploying Craftoo (store, Flower Quest game and image uploads)

Checklist for putting the site live on Vercel (`craftoo-9e5h.vercel.app`) with the Flower Quest
game and photo/image uploads working. Work through it top to bottom.

---

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Add these for **Production** (and Preview if you use it). Copy the values from `.env.local`.
Never prefix the secret ones with `NEXT_PUBLIC_`, or they are sent to every browser.

| Variable | Used for | Secret? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Database and sign-in | No | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database and sign-in from the browser | No | Supabase "anon / publishable" key |
| `SUPABASE_SERVICE_ROLE_KEY` | Orders, coupons, game, admin | **Yes** | Supabase "service_role" key. Server only. |
| `GAME_SESSION_SECRET` | **Flower Quest**: signs game runs and guest cookies | **Yes** | At least 32 characters. Make one with `openssl rand -hex 32`. Without it the game shows "Game session service is not configured". Changing it later logs out guest play counters and cancels games in progress. |
| `FILE_STORAGE_API_KEY` | **Image uploads** (admin product images, customer photos) | **Yes** | Must be exactly the same key as on the file server (section 3). |
| `FILE_STORAGE_URL` | Image uploads | No | Optional. Defaults to `https://nayanfood.in/craftoo/files`. |
| `NEXT_PUBLIC_SITE_URL` | Sitemap, robots.txt, page metadata | No | Optional. The store's public address, e.g. `https://craftoo.in`. Used when **Admin → Settings → Site URL** is empty; if both are empty, Vercel's production domain is used. |
| `NEXT_PUBLIC_SENTRY_DSN` | **Sentry** error tracking, traces and logs | No | `https://02ef11bbad209d163b137f0f382fe5eb@o4512504882593792.ingest.de.sentry.io/4512504893931600` (project `craftoo/craftoo-web`). Without it, Sentry stays off. |
| `SENTRY_AUTH_TOKEN` | Sentry source maps (readable production stack traces) | **Yes** | Sentry → Settings → Auth Tokens → organization token. Only needed at build time. |
| `LOG_LEVEL` | Server logs | No | Optional. `debug`, `info`, `warn` or `error`. Defaults to `info` in production. Logs are JSON lines in Vercel → Logs. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payment | Yes | **Not needed now**. Orders go through WhatsApp. Only for a future payment gateway. |

After adding or changing variables, **redeploy**. Vercel only reads them at build/start.

---

## 2. Database (Supabase → SQL Editor)

Run each file in `supabase/migrations/` once, **in filename order**. Status in the live database
when this was written:

| Migration | What it adds | Status |
|---|---|---|
| `20260308000000_flower_quest.sql` | Game tables, coupons, rewards (campaign starts disabled) | Applied |
| `20261120234500_enable_flower_quest_rewards.sql` | Turns the game's rewards on | Applied (campaign is enabled) |
| `20261121085500_fix_flower_quest_coupon_claim.sql` | Coupon claim fix | Applied |
| `20261122120000_short_flower_quest_coupon_codes.sql` | Short coupon codes (FQ + 8) | Applied |
| `20261123090000_flower_quest_claim_counts_daily_limit.sql` | Guest runs count against the account's daily plays | Applied |
| `20261124100000_short_order_numbers.sql` | 6-character order / bill numbers | Applied |
| `20261124110000_order_item_gift_extras.sql` | Saves gift extras on order items | Applied |
| `20261124120000_order_item_gift_photos.sql` | Saves customer photo links on order items | Applied |
| `20261124130000_user_profile_contact.sql` | Profile: phone, email, delivery address | Applied |
| `20261124140000_order_charges.sql` | Extra charges on orders (delivery, photo prints…) | Applied |
| `20261124150000_flower_quest_india_days.sql` | Game daily limit resets at midnight **India time** | **Run if you haven't** (safe to run again) |

Optional, once: `supabase/scripts/shorten_existing_coupon_codes.sql` shortens coupons issued
before the short-code migration.

### Supabase Auth settings (Authentication → URL Configuration)
- **Site URL**: `https://craftoo-9e5h.vercel.app` (or your own domain later).
- **Redirect URLs**: add the same domain (and `http://192.168.1.14:3000` for local testing).
  Sign-up confirmation emails link back here; a wrong value sends people to the wrong site.

---

## 3. Image storage server (nayanfood.in/craftoo/files)

All images, both product photos uploaded in admin and customers' "Your photo" uploads, are stored
on this PHP file server. **Downloads are public; uploads and deletes need the secret key.**

1. **Upload the script**: copy `deploy/file-storage/index.php` to `/craftoo/files/index.php`.
2. **Set the key on the server**, either way:
   - **Key file (shared hosting)**: create `craftoo-file-storage.key` containing only the key,
     **three folders above** `/craftoo/files`, which is usually your home folder next to
     `public_html`, **not inside it**. If your folders differ, change the path in `uploadKey()`
     in `index.php`.
   - **Or** an environment variable `FILE_STORAGE_API_KEY` for PHP, if your host allows it.
3. **Same key in Vercel** as `FILE_STORAGE_API_KEY` (section 1).
4. **Keep the URL rewrite** that sends `/craftoo/files/<name>` to `index.php` (your existing
   `.htaccess`). Uploads use `PUT /craftoo/files/<name>`, so they must reach the script.
5. Allowed files: JPG, PNG, WebP, GIF, AVIF up to 15 MB. PHP, HTML and SVG are refused, so
   nobody can upload a script. AVIF needs a recent PHP/libmagic; if AVIF uploads are refused, use
   JPG/PNG/WebP.

**Check it works** (from any terminal; nothing is stored by these):
```bash
# A product image opens publicly: expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://nayanfood.in/craftoo/files/<an-existing-image>.png
# Wrong key is refused: expect 401
curl -s -X PUT -H "X-API-Key: wrong" --data-binary "" https://nayanfood.in/craftoo/files/check.png
# Right key reaches the upload step: expect {"error":"Empty or unreadable file"}
curl -s -X PUT -H "X-API-Key: <your key>" --data-binary "" https://nayanfood.in/craftoo/files/check.png
```

### Upload size limit: 4 MB
Uploads go **browser → our Vercel API → file server**, and Vercel accepts about **4.5 MB** per
request. So customer photos and admin images are limited to **4 MB** each (`MAX_UPLOAD_MB` in
`lib/gift-extras.ts`). Larger files are refused with a clear message before uploading; in bulk
upload, a skipped image is listed on the results screen. Most phone photos are under 4 MB; for
bigger ones, customers can send a smaller copy (e.g. WhatsApp-compressed or a screenshot).

To allow full-size originals later, upload straight from the browser to the file server with a
short-lived upload pass (this avoids Vercel’s limit entirely).

---

## 4. Flower Quest game

The game itself (`/play`, images and sounds in `public/games/`) ships with the app; nothing extra
to upload. To have it working live:

- `GAME_SESSION_SECRET` is set in Vercel (section 1).
- The game migrations are applied, and the **campaign is enabled**. Current settings: 8 plays a
  day, coupon minimum order ₹599, maximum discount ₹500, coupons expire after 7 days.
  These live in the `game_campaigns` table; reward tiers (score → % off) in `game_reward_tiers`.
- **India-time days**: run `20261124150000_flower_quest_india_days.sql` so daily plays reset at
  midnight IST.
- The game is **mobile only** (touch controls). Test it on a phone.
- Signed-in players see their earned coupon on the start screen; each account gets one coupon.

---

## 5. Admin → Settings (on the live site, signed in as admin)

- **Brand**: name `Craftoo` (already set).
- **Contact**: phone / WhatsApp `+91 91489 97472` (already set). Add **email, address and
  hours**; they appear on Contact Us, in the footer, in the policies and on PDF bills.
- **SEO**: title and description for search results and link previews.
- **Announcement bar**: update any old "Free shipping above ₹599" message to **₹1,000**.

Customer WhatsApp orders go to the number in `lib/whatsapp-order.ts` (`WHATSAPP_NUMBER`,
currently `919148997472`). Change it there if the order number ever changes.

---

## 6. Build check before each deploy

`next.config.mjs` has `typescript.ignoreBuildErrors: true`, so **Vercel builds even when the code
has type errors**. Before deploying, run locally:

```bash
npm run type-check   # only these known, older errors are expected:
                     # components/editorial-story.tsx, components/ui/resizable.tsx,
                     # hooks/use-site-settings.ts
npm run test:game    # game and coupon tests (18 should pass)
npm run build
```

---

## 7. After deploying: quick test

1. Home page loads; footer shows Craftoo, the logo and the contact number.
2. Sign up / sign in works, and the confirmation email links to the live domain.
3. Add a product → tick **Your photo** → upload a photo; a file over 4 MB should be refused with a message.
4. Checkout: address saves → order summary → review → **Place order on WhatsApp** opens WhatsApp
   to +91 91489 97472, the cart clears and the home page shows the confirmation.
5. Admin → Orders: the order is there with the photos; **Verify** the coupon if used; add a charge;
   **Download bill (PDF)**.
6. Profile shows the saved address and the order with its progress.
7. On a phone: `/play` starts a game; finishing with a reward while signed in gives a coupon.

---

## 8. Security notes

- `SUPABASE_SERVICE_ROLE_KEY`, `GAME_SESSION_SECRET` and `FILE_STORAGE_API_KEY` are full-access
  secrets. Keep them only in Vercel and `.env.local` (git-ignored), never in code or chats.
- If a secret was ever shared or committed, rotate it (Supabase → API settings; make a new
  `openssl rand -hex 32` for the others) and update Vercel and the file server.
- Customer photos are public to anyone who has the exact (random, unguessable) link. See the
  Privacy Policy wording.
