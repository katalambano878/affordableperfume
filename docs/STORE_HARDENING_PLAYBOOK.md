# Store Hardening Playbook (reusable)

Use this when bringing another MultiMey / Next.js store to production on **big-vps + Coolify + plain Postgres**.

This is distilled from **Affordable Perfumes GH** (`affordableperfume`) work in July 2026. Projects differ in schema names, brand copy, and payment providers — follow the **intent**, then adapt the **paths**.

Related docs in this repo:

| Doc | When to use |
|-----|-------------|
| [`SUPABASE_TO_PLAIN_POSTGRES_MIGRATION.md`](./SUPABASE_TO_PLAIN_POSTGRES_MIGRATION.md) | Full Supabase → self-hosted Postgres cutover |
| [`SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Short project-specific cutover notes + env checklist |

---

## 0. How to use this playbook

1. Clone / open the target store repo.
2. Skim each section below. Mark **Apply / Skip / Adapt**.
3. Prefer copying **patterns** (helpers, scripts, aggregation logic) over blind file paste.
4. Deploy only after the verification checklist at the end passes.
5. Never invent secrets; wait for real `.env` / Coolify env / `DATABASE_URL`.

**Staff VPS (this machine):**

```bash
ssh big-vps
sudo fleet apps
sudo fleet app <coolify-app-name>
sudo fleet deploy <coolify-app-name>
```

Confirm the live image matches the git SHA you expect:

```bash
ssh big-vps "sudo docker ps | grep <coolify-uuid-prefix>"
# Image tag looks like: <uuid>:<full-git-sha>
```

Coolify stores encrypted env in its DB — editing only the on-disk container `.env` is not enough for durable changes.

---

## 1. Architecture baseline (every migrated store)

### Goal

Keep `supabase.from(...)` / `supabase.auth` / `supabase.storage` in app code, but point them at **this app** + plain Postgres.

### Must-have pieces

| Concern | Typical path | Notes |
|---------|--------------|-------|
| Mode switch | `lib/db/mode.ts` | `DATABASE_URL` → plain PG |
| Pool | `lib/db/pool.ts` | Shared `pg` pool; parse `numeric` as float |
| Query compat | `lib/db/supabase-compat.ts` | Select/embed/upsert |
| FK embeds | `lib/db/fk-map.ts` | **Per-project** — update for each schema |
| Auth shim | `lib/db/auth.ts` + `app/auth/v1/[...path]` | bcrypt + JWT |
| Storage shim | `lib/db/storage.ts` + `app/storage/v1/object/...` | Disk under `STORAGE_ROOT` |
| REST shim | `app/rest/v1/[table]` + `rpc/[fn]` | Browser supabase-js |
| Server DB | `lib/server-db.ts` / `supabaseAdmin` | Prefer for API routes |

### Env cutover trio (set together)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Enables in-process Postgres |
| `NEXT_PUBLIC_USE_PLAIN_PG=true` | Edge middleware JWT path (no `pg` on Edge) |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin**, not `*.supabase.co` |

Also usually required: `AUTH_JWT_SECRET` (or `JWT_SECRET`), `NEXT_PUBLIC_APP_URL`, `STORAGE_ROOT` / `STORAGE_LOCAL_PATH`, `RESEND_API_KEY`, payment/SMS keys.

**Failure mode:** `DATABASE_URL` set but `NEXT_PUBLIC_USE_PLAIN_PG` unset → server on PG, middleware still hitting hosted Supabase → admin lockouts.

### Shim pitfalls to re-check on every project

- Nested embeds need correct `fk-map` (and often auto-include join FK columns).
- Browser storage uploads: multipart / Content-Type handling on storage routes.
- Upsert via REST vs in-process client differences.
- RPCs used at checkout (`mark_order_paid`, `upsert_customer_from_order`, `update_customer_stats`) must exist in the live DB.
- Order lookups by `order_number` must not cast non-UUID strings to UUID.
- **Count / `Prefer: count=exact`:** return `Content-Range: */N` for head/empty responses so supabase-js can parse totals (shop “12 of 0” bug).
- Auth routes that return **204** must not call `NextResponse.json(..., { status: 204 })` (invalid — Node throws).

---

## 2. Deploy & build hygiene (Coolify / nixpacks)

### Workflow

1. Commit on `main` (or staging branch).
2. `git push origin HEAD`.
3. `sudo fleet deploy <app-name>`.
4. Confirm live image hash matches commit (`docker ps` image tag ≈ git SHA).
5. Smoke-test home, auth, shop scroll, one admin write, one storefront read.
6. If the store is a PWA, **bump the service-worker cache version** whenever HTML/chunk strategy changes (see §16).

### Common build failures

| Symptom | Fix pattern |
|---------|-------------|
| `npm ci` `ECONNRESET` | Retry deploy (network); not a code bug |
| TypeScript: local `const sendEmail = Boolean(...)` shadows import | Rename local flag (`wantEmail`) |
| TypeScript: implicit `any` in admin API `.map()` | Type rows from helper (`PendingMoolreOrder`) or annotate callback param — **build fails on Coolify** |
| Build OK but runtime 503 on `/auth/v1` or `/rest/v1` | Missing `DATABASE_URL` in Coolify env |
| Deploy queued but old SHA still live | Wait / check Coolify queue; confirm with `docker ps` image tag |

### Image optimizer on Coolify

If `/_next/image?url=...` returns **HTTP 200 with `Content-Length: 0`**, sharp is broken in the image:

```ts
// next.config.ts
images: {
  unoptimized: true, // serve originals until sharp runtime is healthy
  // keep remotePatterns for /storage/** on your domain
}
```

Static files under `public/` still work; Next Image just skips optimization.

---

## 3. Performance: images

### Apply on every store with heavy heroes / uploads

1. **Batch compress `public/`** → WebP (keep PWA icons as PNG if manifest requires).
2. **Batch compress production storage** on VPS (`STORAGE_ROOT`).
3. **Compress on upload** in storage route via `lib/image-compress.ts` (sharp).
4. Point code at `.webp` paths; keep a **resolver** for legacy `.png` CMS/DB URLs.

### Shared product-image helper (recommended)

Add something like `lib/product-display.ts` + `lib/storage-url.ts`:

- Normalize relative `/storage/...` and bare object keys to loadable URLs.
- Prefer a **same-origin** placeholder (`/images/product-placeholder.svg`) over `via.placeholder.com` (third-party + SW failures show “Image unavailable”).
- Shared commerce helpers: min variant price, summed variant stock (same logic on shop + PDP + cards).

### Typical scripts

| Script | Purpose |
|--------|---------|
| `scripts/compress-public-images.mjs` | Local `public/` → WebP |
| `scripts/compress-storage.mjs` | VPS storage tree |
| `npm run compress:images` / `compress:storage` | Wrappers |

### After converting heroes to WebP

Update both:

- Code defaults (`/hero-….webp`, `/heroes/….webp`)
- **DB `banners.image_url`** (admin homepage often still stores old `.png`)

```sql
UPDATE banners
SET image_url = replace(image_url, '.png', '.webp')
WHERE image_url LIKE '%.png';
```

Or map known paths in the homepage hero sanitizer so old CMS values keep working.

---

## 4. Storefront UX (adapt per brand)

These are product decisions — apply only when the merchant wants them.

| Change | Intent | Adapt |
|--------|--------|-------|
| Remove homepage hero trust strip | Less clutter in first viewport | Delete the absolute bottom bar on hero; don't remove shipping facts from `/shipping` unless asked |
| Denser category / product grids | Faster scan on mobile | Compact card width, tighter gaps; **fixed card heights** so infinite scroll doesn’t jump |
| Footer Collection links | Dead links kill SEO/trust | Map “Signature / Featured / New” to real routes (`/categories`, `?featured=true`, `?sort=new`) |
| Shipping copy | Match real ops | Nationwide window + price range; **remove “free shipping over X”** if not offered |
| Returns | Match ops | Redirect `/returns` → `/contact`; remove “30-day returns” trust lines from cart/PDP if no returns portal |
| Duplicate CTAs | Less confusion | Drop footer “Concierge” if it is the same as Contact |
| Social login stubs | Don’t tease dead features | Remove disabled Google/Facebook buttons until OAuth is wired |
| **Cart / checkout coupon codes** | Merchant doesn’t run promo codes | Remove promo UI; no client-side “apply code” without server validation |
| PageHero / about cards | Consistency | Reuse shared hero image map (`lib/hero-images.ts`) |

**Rule:** one job per section; don’t leave fake UI that looks clickable (`alert('coming soon')`, disabled social buttons, stub admin actions).

### Coupons & discount codes (storefront off)

When the merchant **does not** want customers entering promo codes (common for perfume / fixed-price catalogs):

| Do | Don’t |
|----|--------|
| Remove cart coupon block (`AdvancedCouponSystem` or inline “Enter code”) | Leave a code field that never hits the server or always fails |
| Remove **Coupons** from admin sidebar if staff shouldn’t manage codes | Delete `coupons` table / admin page unless asked — `/admin/coupons` can stay for direct URL |
| Set checkout `discount_total: 0` (or server-validated only) | Trust client `localStorage` coupon state on place-order |
| Keep **compare-at / “Save X%”** on PDP (list price vs sale price) | Confuse that with checkout coupon codes |

**Affordable Perfumes GH (Jul 2026, `dd77c1a`):**

- Deleted `components/AdvancedCouponSystem.tsx`
- Stripped coupon UI from `app/(store)/cart/page.tsx`
- Removed **Coupons** menu item from `app/admin/layout.tsx`
- Checkout continues with `discount_total: 0` in order payload

**Still separate:** newsletter welcome codes via `NEWSLETTER_PROMO_CODE` + `/api/newsletter/subscribe` (§9) — only promise a code if a matching coupon exists in admin **or** remove that copy from the welcome email.

**If coupons return later:** wire validate → apply on **server** at checkout (amount from DB), increment `usage_count`, and re-add storefront UI only when that path is tested end-to-end.

---

## 5. Shop grid reliability

### Symptoms seen in production

- “Showing 12 of **0** products”
- White screen: *Application error: a client-side exception…*
- Grid **jumps / remounts** while scrolling (categories load mid-scroll)
- Uneven card rows (optional origin/swatches change height)

### Patterns

1. **Counts:** separate count query; REST `Content-Range: */N` for empty/head counts (§1).
2. **Active only:** `.eq('status', 'active')` on shop, homepage featured, PDP client + server metadata.
3. **Client cache:** `lib/query-cache.ts` — do **not** cache `{ error: … }` responses; don’t `invalidateCachePrefix` on every successful fetch.
4. **Stable scroll:**
   - Do not put `categories` array identity in the product-fetch effect deps (use a ref).
   - Only show skeletons when `products.length === 0` (never replace a filled grid while loading more).
   - Fixed aspect ratio + reserved title/price/action heights on `ProductCard`.
   - Stable sort tie-break: `.order(...).order('id', { ascending: true })` so pages don’t reshuffle.
5. **Price safety:** always `Number(price)` before `.toFixed` (numeric/string edge cases white-screen the grid).
6. **CMS hook:** `useCMS()` should return a default context, not throw — a missing provider must not white-screen storefront pages.
7. Add `app/error.tsx` with a Recover / Go to Shop CTA (better than bare Next application error).

Reusable helpers: `lib/product-display.ts`, hardened `components/ProductCard.tsx`, shop page infinite-scroll pattern in `app/(store)/shop/page.tsx`.

---

## 6. Product detail page (PDP)

| Issue | Fix |
|-------|-----|
| “Image unavailable” | Often **service worker** image fallback, not React — see §16; also resolve URLs via `resolveStorageUrl` / `LazyImage` |
| GH₵0.00 / Out of stock | Use variant-aware commerce helper; don’t treat base `quantity` alone when variants exist |
| Draft/archived visible | Filter `status = 'active'` on client fetch and `generateMetadata` |
| Placeholder host | Prefer `/images/product-placeholder.svg` over `via.placeholder.com` |

---

## 7. Checkout & saved addresses

### Problem

Address book saves in Account, but checkout only prefilled **email** — customer retypes every order.

### Pattern

On checkout mount (logged-in):

1. Load `addresses` for `user_id` (default first) → map `full_name` / `address_line1` / `city` / `state` → shipping form.
2. Fallback: `profiles` → `customers` → last order `shipping_address`.
3. Show a **Saved addresses** radio list when multiple exist.
4. On place order, if “Save this address” (default on) or no addresses yet → upsert into `addresses` with `is_default`.

Field map reminder: account `state` ≈ checkout `region`; `address_line1` ≈ `address`.

---

## 8. Account order actions (no “coming soon”)

Wire real handlers on order history:

| Button | Behavior |
|--------|----------|
| Track Order | `/order-tracking?order=…&email=…` (auto-track; session email if missing) |
| Reorder | Resolve `product_id`s, add available lines to cart, open cart |
| Invoice | Customer printable page e.g. `/account/invoice/[id]?print=true` (ownership check) |
| Get Help | `/contact?order=…&subject=…` and prefill contact form |

Never ship `alert('… coming soon!')` on primary commerce actions.

---

## 9. Newsletter (replace fake subscribe)

### Problem

Many templates use `setTimeout` “success” with no backend.

### Pattern

1. `POST /api/newsletter/subscribe` (rate-limited).
2. Upsert into `customers` with a tag (e.g. `newsletter`).
3. Send welcome email via existing mail helper (`lib/notifications.ts`).
4. Promo code from env: `NEWSLETTER_PROMO_CODE` (create matching coupon in admin if you promise a code).
5. Admin campaigns: audience filter = that tag.

### Env

- `RESEND_API_KEY`
- `ADMIN_EMAIL` / merchant inbox
- `NEWSLETTER_PROMO_CODE`
- Brand From: usually `noreply@{store-host}` derived from site settings

---

## 10. Payments & notifications (Moolre)

### Merchant identity

Set Coolify env (not only container file):

- `MOOLRE_MERCHANT_EMAIL` → real store inbox  
- `MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_CALLBACK_SECRET`  
- Fallback in code should use the store domain, not a template default like `admin@standardecom.com`

### Payment flow (Affordable pattern)

| Step | Path | Notes |
|------|------|--------|
| Initiate link | `POST /api/payment/moolre` | Amount from **DB only**; unique `externalref`: `{order_number}-R{timestamp}` stored in `metadata.moolre_payment_ref` |
| Webhook | `POST /api/payment/moolre/callback` | Validates `MOOLRE_CALLBACK_SECRET` (`body.secret` or `data.secret`); strips `-R\d+$` from `externalref` → order number |
| Customer redirect verify | `POST /api/payment/moolre/verify` | Order-success page; same Moolre status logic as admin reconcile |
| Admin reconcile | `GET/POST /api/admin/payment/moolre/reconcile` | `verifyAuth(..., { requireAdmin: true })`; single order or bulk `mode: "pending"` |

Shared server logic lives in **`lib/payment/moolre.ts`** (`fetchMoolrePaymentStatus`, `isMoolrePaymentSuccessful`, `reconcileMoolreOrder`, `listPendingMoolreOrders`). Callback and verify routes should call this helper — don’t duplicate status parsing.

### Moolre API gotchas (learned Jul 2026)

1. **Callback payload uses `data.txstatus`**, not only docs’ `txtstatus`. Parse both:  
   `data.txstatus ?? data.txtstatus ?? body.txstatus`.
2. **Payment Status API** (check if paid):  
   `POST https://api.moolre.com/open/transact/status`  
   Body: `{ type: 1, idtype: "1", id: "<externalref>", accountnumber: "<MOOLRE_ACCOUNT_NUMBER>" }`  
   Headers: `X-API-USER`, `X-API-PUBKEY`.  
   **Do not** use `/embed/status` — it returned HTML and broke verify/reconcile.
3. **Lookup refs:** try `metadata.moolre_payment_ref` first, then bare `order_number`. Moolre keys successful payments on the **`-R…` ref**, not the order number alone (`Transaction not found` / `SS07`).
4. **Success:** `status === 1` and (`txstatus === 1` or message contains “successful”). Reject “not found”, “fail”, “declined”.
5. **Amount check:** compare `data.amount` to `orders.total` (±0.01) before `mark_order_paid`.

### When payment confirms

Ensure RPC (or equivalent) runs:

- `mark_order_paid(order_ref, moolre_ref)`
- `update_customer_stats` (or UI aggregates orders live — see §11)
- Order confirmation SMS/email via `sendOrderConfirmation` (callback, verify, and reconcile paths)

### Missed callbacks — why orders stay “pending”

| Cause | Mitigation |
|-------|------------|
| Moolre webhook never hit your server | Customer **order-success** page calls `/api/payment/moolre/verify`; admin **Payment Reconcile** |
| Deploy / container restart during checkout | Moolre may not retry; reconcile by payment ref |
| Wrong status endpoint in code | Fix to `/open/transact/status` + `txstatus` |
| Customer abandoned MoMo (no PIN) | Moolre returns `SS07` / not found — **not** paid; don’t mark manually without provider proof |
| Amount mismatch | Reconcile rejects; investigate fraud or wrong order total |

### Admin UI (reconcile)

| Surface | Path |
|---------|------|
| Sidebar | **Payment Reconcile** → `/admin/payments/reconcile` |
| Orders list | Awaiting Payment tab → green “check Moolre” icon |
| Order detail | Payment Info → **Check Moolre Payment** when unpaid + method moolre |

Bulk: **Reconcile recent pending (40)** — rate-limit aware; each row hits Moolre sequentially.

**Ops:** After a bad deploy window or merchant report, run bulk reconcile once, then spot-check any order with a MoMo receipt against Moolre dashboard before manual `mark_order_paid`.

### Campaign / notify route

Never shadow imported helpers:

```ts
// BAD
const sendEmail = Boolean(channels?.email);
await sendEmail({ ... }); // TypeError / build fail

// GOOD
const wantEmail = Boolean(channels?.email);
```

---

## 11. Admin: customers order counts

### Problem

`customers.total_orders` / `total_spent` / `last_order_at` go stale if RPCs aren’t called on every paid path (POS, cash, failed RPC, migration).

### Pattern (recommended UI fix)

On admin customers list:

1. Load `customers`.
2. Load recent `orders` (cap, e.g. 5000).
3. Aggregate in memory by **email** and **user_id** (skip cancelled for totals).
4. Merge onto each customer row.
5. Optionally append “guest” rows that have orders but no `customers` row.

Detail page should also query orders by `user_id` **or** `email`.

### Optional DB backfill

```sql
UPDATE customers cu SET
  total_orders = s.orders,
  total_spent = s.spent,
  last_order_at = s.last_order
FROM (
  SELECT lower(email) AS email,
         count(*) FILTER (WHERE status IS DISTINCT FROM 'cancelled')::int AS orders,
         coalesce(sum(total) FILTER (WHERE status IS DISTINCT FROM 'cancelled'), 0) AS spent,
         max(created_at) FILTER (WHERE status IS DISTINCT FROM 'cancelled') AS last_order
  FROM orders
  WHERE email IS NOT NULL AND email <> ''
  GROUP BY 1
) s
WHERE lower(cu.email) = s.email;
```

Prefer live aggregation in admin UI even after backfill.

---

## 12. Product SEO

### Pattern

1. Shared helper: `lib/product-seo.ts` (`slugify`, `buildProductSeo`).
2. Admin product form: auto-fill SEO when empty / on name change; merge metadata on save.
3. Status casing: match DB enum (`active` vs `Active`).
4. One-shot backfill: `scripts/backfill-product-seo.cjs` with `DATABASE_URL`  
   (`npm run seo:backfill` inside app container if needed).

### Verify

- Product page `<title>` / meta description populated.
- Slugs unique; no collisions on create.

---

## 13. Blog (don’t leave “coming soon” alerts)

### Pattern

| Piece | Path pattern |
|-------|----------------|
| List | `app/admin/blog/page.tsx` |
| Form | `components/admin/BlogPostForm.tsx` |
| New / edit | `app/admin/blog/new`, `app/admin/blog/[id]/edit` |
| Storefront list/detail | `app/(store)/blog/...` reading `blog_posts` where `status = 'published'` |

### Requirements

- Real insert/update/delete on `blog_posts` (no `alert('coming soon')`).
- Slug auto from title; unique slug.
- Featured image upload to storage bucket (`media` / `blog` — match project).
- Storefront uses **slug** URLs; resolve by slug or id.
- Sanitize HTML on render (`sanitizeHtml`).

If the merchant doesn’t want a blog, hide the module in admin modules — don’t leave a stub button.

---

## 14. Admin reliability checklist

Run through these on every store after migration:

| Area | What to verify |
|------|----------------|
| Admin layout | Session resolves; no infinite “Loading Admin…” |
| Products list | Category + stock filters work; select-all = filtered set |
| Product create | Slug collision handling; images upload |
| Categories | Cascade / unlink products on delete (FK-safe) |
| Orders list | Shows new orders; payment link resend sends `Authorization`; Moolre reconcile icon on awaiting payment |
| Payment reconcile | `/admin/payments/reconcile` lists pending Moolre orders; single + bulk check |
| Inventory | Export CSV; Import CSV (SKU + qty); Edit → product form; View → storefront |
| Analytics | Export CSV wired (not a dead button) |
| Reviews | Status values match DB enum |
| POS | Loads products with limit; can create order + customer |
| Coupons | Create/edit/list **or** hidden from nav when storefront promos disabled (§4) |
| Customers | Order counts accurate (§11) |
| Marketing campaigns | Email and/or SMS; subject not required for SMS-only |
| Wishlist (storefront) | Same storage source as header badge |
| Auth | Signup, login, logout, **address book → checkout autofill** |

Purge obvious test accounts/orders before handoff (`example.com`, `cursor-audit-*`, smoke-test emails) only with merchant approval.

---

## 15. Brand / ops copy (project-specific)

Before launch, replace template leftovers:

- Merchant email defaults (`MOOLRE_MERCHANT_EMAIL`, `ADMIN_EMAIL`)
- Announcement bar text
- Shipping policy (zones vs nationwide; no free-shipping promises if unpaid)
- Returns: remove portal + cart/PDP “30-day returns” if not offered
- **Coupons:** no promo-code field on cart/checkout if merchant doesn’t use codes; align newsletter copy with reality (§4)
- Footer: drop duplicate Concierge / Contact; fix support email / socials
- Auth: remove Google/Facebook until real OAuth exists
- `site_settings` name, logo, phone
- Sitemap / canonical host (`www` vs apex)
- Remove placeholder hero trust claims that contradict shipping policy

---

## 16. PWA / service worker (critical)

Stale SW caches are a top cause of **“Application error: a client-side exception has occurred”** on mobile after deploys (old HTML shell → missing `/_next/static` chunks).

### Rules

1. **Bump `CACHE_VERSION`** on every SW behavior change (`sl-v2.2`, …).
2. **Never cache HTML / navigations / `/_next/data`.** Network-only; offline fallback = `/offline` only.
3. **Do not pre-cache `/`, `/shop`, etc.** Pre-cache only offline shell + tiny static assets.
4. **Same-origin `/storage/`** — network only (cache-first + SVG “Image unavailable” poisons product images).
5. Hashed `/_next/static` can stay cache-first.
6. On activate, delete caches that don’t match the current version names.
7. Nav / PWA: don’t force `user-select: text` on all links (blinking caret). Use `select-none` on header/nav/footer links.

After deploy, ask merchants on PWA installs to **hard refresh once** or reopen the app so the new SW activates.

---

## 17. Verification checklist (copy per project)

Replace `$BASE` and app name.

```bash
# Deploy image matches commit
ssh big-vps "sudo docker ps | grep <uuid-prefix>"

# Storefront
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/blog"

# Heroes (raw file, not only /_next/image)
curl -sI "$BASE/hero-areej.webp" | head -n 5

# REST / auth shims
curl -s "$BASE/rest/v1/site_settings?select=key&limit=1"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'

# Newsletter
curl -s -X POST "$BASE/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-newsletter@example.com"}'

# Storefront APIs
curl -s "$BASE/api/storefront/products?featured=true&limit=2" | head -c 300
curl -s "$BASE/api/storefront/categories" | head -c 200
```

Manual:

- [ ] Homepage hero shows real photos (not black bar)
- [ ] Shop: total count correct; scroll does not jump / remount grid
- [ ] PDP: image loads; price/stock match admin for active products
- [ ] Logged-in checkout autofills saved address
- [ ] Order history: Track / Reorder / Invoice / Help all work (no alerts)
- [ ] Cart has no returns promise if returns aren’t offered
- [ ] Cart / checkout have **no** promo-code UI if coupons are disabled (§4)
- [ ] Footer has no duplicate Concierge ↔ Contact
- [ ] Login has no dead Google/Facebook buttons
- [ ] Admin → Customers shows non-zero orders for known buyers
- [ ] Admin → Blog → New Post saves draft/publish
- [ ] Admin → Inventory + Analytics export work
- [ ] Admin → Products SEO fields auto-fill
- [ ] Checkout / Moolre callback still marks paid (check logs: `TX status` not `undefined`)
- [ ] Order-success verify recovers payment if callback missed (`/api/payment/moolre/verify`)
- [ ] Admin → Payment Reconcile marks a known-paid test ref (or shows `not_paid` for abandoned cart)
- [ ] After deploy, PWA hard-refresh once; no white-screen on `/shop`
- [ ] No “coming soon” alerts on admin or account primary actions

---

## 18. Suggested apply order on a new store

1. Confirm Coolify app + `DATABASE_URL` + plain-PG env trio.  
2. Run migration playbook verification (REST, auth, embeds, storage upload, Content-Range counts).  
3. Fix build blockers (TS shadows, eslint).  
4. Images: compress public + storage; set `unoptimized` if optimizer is empty; fix banner URLs; add product URL helper.  
5. Fix service worker (§16) before heavy PWA testing.  
6. Wire newsletter + merchant emails; **Moolre:** shared `lib/payment/moolre.ts`, callback `txstatus`, verify + admin reconcile on `/open/transact/status`.  
7. Admin customers live order aggregation + optional SQL backfill.  
8. Product SEO helper + backfill.  
9. Replace blog stub with real editor (or hide module).  
10. Shop scroll stability + PDP active/commerce helpers.  
11. Checkout address autofill + order history actions.  
12. Storefront UX / shipping / returns / footer / auth stub / **coupon UI** audit.  
13. Full verification checklist → deploy → re-check image hash + PWA refresh.

---

## 19. What differs between projects

Expect to **adapt**, not copy blindly:

| Area | Usually differs |
|------|-----------------|
| `fk-map.ts` | Table/column names |
| Payment provider | Moolre vs other |
| Storage path / volume | Coolify mount |
| Enum casings | `active` vs `Active` |
| Blog / wholesale / POS modules | Enabled set |
| Brand fonts/colors | Design system |
| Shipping / returns rules | Ops reality |
| Whether Supabase was fully removed | Some stores still hybrid |

If a store was **never** on Supabase, skip §1 cutover and still apply §2–§18 for quality.

---

## 20. Affordable Perfumes GH — reference snapshot

| Item | Value |
|------|--------|
| Repo | `katalambano878/affordableperfume` |
| Coolify app | `affordableperfume-app` |
| UUID prefix | `slrbujar86myr4hgjh4lzwb9` |
| Production | https://www.affordableperfumesgh.com |
| Notable commits (Jul 2026) | Plain-PG harden → … → returns/concierge cleanup → **remove cart/admin-nav coupons** (`dd77c1a`) → **Moolre callback/verify fix + admin payment reconcile** (`a65b43a`, `bcad03e`) |

Key reusable artifacts from this repo to port:

- `lib/db/*` + REST/auth/storage routes  
- `lib/image-compress.ts` + compress scripts  
- `lib/product-seo.ts` + `scripts/backfill-product-seo.cjs`  
- `lib/product-display.ts` + `lib/storage-url.ts` + `public/images/product-placeholder.svg`  
- `lib/query-cache.ts` (skip caching errors)  
- `app/api/newsletter/subscribe`  
- Admin customers aggregation in `app/admin/customers/page.tsx`  
- `components/admin/BlogPostForm.tsx` + blog admin/store routes  
- Shop infinite-scroll stability in `app/(store)/shop/page.tsx`  
- Checkout address prefill in `app/(store)/checkout/page.tsx`  
- Order actions + `app/(store)/account/invoice/[id]/page.tsx`  
- **Coupons off (storefront):** remove `AdvancedCouponSystem`; strip cart promo UI; drop admin nav entry — see §4 (`dd77c1a`)  
- `public/service-worker.js` (no HTML cache; storage network-only)  
- `app/error.tsx`  
- `next.config.ts` `images.unoptimized` + storage `remotePatterns`  
- **Moolre:** `lib/payment/moolre.ts`; `app/api/payment/moolre/{route,callback,verify}`; `app/api/admin/payment/moolre/reconcile`; `app/admin/payments/reconcile/page.tsx`; reconcile actions on `app/admin/orders/page.tsx` + `OrderDetailClient.tsx`

### Quick Moolre reconcile (ops, inside running app container)

Use admin UI in production when possible. For one-off bulk recovery after an incident, a script can call the same status API + `mark_order_paid` (never invent payment proof):

- Query: unpaid + `payment_method = 'moolre'` + not cancelled  
- Status: `POST /open/transact/status` with `metadata.moolre_payment_ref`  
- Only mark when `txstatus === 1` and amount matches  

---

*Keep this playbook updated when a new store invents a better pattern — add a short note under the relevant section, not a second competing doc.*
