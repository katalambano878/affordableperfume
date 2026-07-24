# Affordable Perfumes — Supabase → Postgres migration guide

Project: **affordableperfume** (MultiMey / Affordable Perfumes GH)  
Stack: Next.js 15 App Router, compatibility layer in `lib/db/`, deployed on **big-vps** (Coolify).

## Architecture (post-migration)

| Supabase feature | Replacement |
|------------------|-------------|
| Postgres + PostgREST | `lib/db/supabase-compat.ts` + in-process `pg` pool; HTTP shim `app/rest/v1/[table]` |
| Auth (GoTrue) | `lib/db/auth.ts` + `app/auth/v1/[...path]` |
| Storage | `lib/db/storage.ts` + `app/storage/v1/object/...` |
| RPC | `app/rest/v1/rpc/[fn]` + `supabaseAdmin.rpc()` |

**Browser code** keeps `@supabase/supabase-js` via `lib/supabase.ts`, with `NEXT_PUBLIC_SUPABASE_URL` pointing at **this app’s origin** (not `*.supabase.co`).

**Server code** should use `serverDb` from `lib/server-db.ts` (alias of `supabaseAdmin`) so reads/writes use the in-process pool when `DATABASE_URL` is set.

## Required environment (plain Postgres cutover)

Set **all** of these together on production and staging:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Enables `isPlainPostgres()` — in-process DB for API/admin/notifications |
| `NEXT_PUBLIC_USE_PLAIN_PG=true` | Edge middleware JWT admin/wholesale checks (no `pg` on Edge) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as public app URL, e.g. `https://www.affordableperfumesgh.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Any stable string (shim ignores real Supabase anon semantics) |
| `AUTH_JWT_SECRET` | HS256 secret for access tokens (or `JWT_SECRET` / migrated `SUPABASE_JWT_SECRET`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy name; still used for hosted fallback and some middleware paths |
| `NEXT_PUBLIC_APP_URL` | Canonical storefront URL |
| `STORAGE_LOCAL_PATH` | Disk root for uploads (VPS path, e.g. under `/var/www/.../uploads`) |

**Failure mode:** `DATABASE_URL` set but `NEXT_PUBLIC_USE_PLAIN_PG` unset → server uses Postgres, middleware still calls hosted Supabase auth → admin lockouts.

## Deployments (July 2026)

| App | Branch | URL |
|-----|--------|-----|
| `affordableperfume-app` | `main` | https://affordableperfumesgh.com |
| `affordableperfume-staging` | `staging/plain-postgres` | https://affordableperfume-staging.169-58-8-203.sslip.io |

## Verification checklist

Run after each deploy:

```bash
# Home + REST
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s "$BASE/rest/v1/site_settings?select=key&limit=1"

# Embeds (compat + FK map)
curl -s "$BASE/rest/v1/products?select=id,name,product_images(url)&limit=1"

# Storefront APIs (must use serverDb in app code)
curl -s "$BASE/api/storefront/categories" | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/storefront/products?featured=true&limit=2"

# Auth shim (expect 400 on bad creds, not 503)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'
```

503 on `/auth/v1` or `/rest/v1` → `DATABASE_URL` missing in runtime env.

## Schema / RPC

Canonical SQL: `supabase/migrations/20260209000000_complete_schema.sql`

Payment/checkout depend on:

- `public.mark_order_paid(order_ref, moolre_ref)`
- `public.upsert_customer_from_order(...)`
- `public.update_customer_stats(p_customer_email, p_order_total)`

## Recovery work log (2026-07-24)

### Completed in repo

- **`lib/supabase.ts`**: build-safe client init (no throw when env missing at compile time).
- **`lib/server-db.ts`**: single server entry point for RSC/API/notifications.
- **Server-side DB**: `app/layout.tsx`, `app/manifest.ts`, `app/(store)/categories/page.tsx`, `app/(store)/product/[slug]/page.tsx`, `lib/notifications.ts` → `serverDb`.
- **API routes**: `storefront/*`, `wholesale/products`, `cron/payment-reminders` → `serverDb` / `supabaseAdmin` (no raw HTTP supabase-js on server).
- **`middleware.ts`**: `usePlainPostgresAuth()` helper; admin auth fails closed without service key; wholesale session verified (JWT or hosted `getUser`).
- **`lib/db/mode.ts`**: documented Edge vs server mode flags.

### Remaining (track until zero defects)

- [ ] Align production Coolify env: confirm `NEXT_PUBLIC_USE_PLAIN_PG=true` + `DATABASE_URL` on `affordableperfume-app`.
- [ ] Merge verified fixes from `staging/plain-postgres` into `main` (admin modules refactored on staging).
- [ ] End-to-end: signup/login, checkout, Moolre pay + callback, admin CRUD, image upload, POS RPC.
- [ ] Replace legacy scripts (`scripts/create-admin-user.js`, `test-login.js`) with Postgres-native admin CLI.
- [ ] Remove hosted Supabase env vars after cutover verification.
- [ ] `@supabase/supabase-js` remains intentionally for browser REST/auth/storage shims — not a hosted Supabase dependency when URL points at self.

## FK map maintenance

When adding tables or FKs, regenerate `lib/db/fk-map.ts` from live DB (see `docs/SUPABASE_TO_PLAIN_POSTGRES_MIGRATION.md` §2.3).
