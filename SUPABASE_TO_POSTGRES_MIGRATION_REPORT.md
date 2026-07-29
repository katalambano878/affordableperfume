# Supabase → Plain PostgreSQL Migration Report

**Project:** Affordable Perfumes GH  
**Date:** 2026-07-29  

Related: `docs/SUPABASE_TO_PLAIN_POSTGRES_MIGRATION.md`, `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`

## Feature matrix

| Supabase feature | Replacement | Status |
|------------------|-------------|--------|
| PostgREST queries | `app/rest/v1` + `lib/db/supabase-compat.ts` | Complete |
| Auth (GoTrue) | `app/auth/v1` + `lib/db/auth.ts` (bcrypt + JWT) | Complete |
| Storage | `app/storage/v1` + `lib/db/storage.ts` + `STORAGE_ROOT` | Complete |
| Service role admin | `lib/supabase-admin.ts` → pg client when `DATABASE_URL` | Complete (hardened) |
| RLS | Application auth + REST write guards | Partial → improved this pass |
| Realtime | Not used / polling where needed | N/A |
| Edge functions | Next.js API routes | Complete |
| RPC | Postgres functions via compat `.rpc()` (`mark_order_paid`, etc.) | Complete |

## Env cutover trio (required together)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Enables in-process Postgres |
| `NEXT_PUBLIC_USE_PLAIN_PG=true` | Edge middleware JWT path |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin**, not `*.supabase.co` |

Also: `AUTH_JWT_SECRET` / `JWT_SECRET`, storage paths, Resend, Moolre keys.

## Remaining Supabase references

| Item | Action |
|------|--------|
| `@supabase/supabase-js` package | **Keep** — browser client against app origin shim |
| `middleware.ts` hosted fallback | Prefer plain-PG JWT when `DATABASE_URL` present |
| `scripts/apply-rls*.mjs` | Deprecated — do not run |
| `next.config.ts` `*.supabase.co` images | Optional legacy remotePattern |
| `public/service-worker.js` supabase.co storage branch | Legacy; network-only for `/storage/` same-origin |

## Schema / data notes

- Order numbers are non-UUID strings; lookups must not cast to UUID.
- `numeric` totals parsed as float in pool.
- Content-Range `*/N` required for count heads (shop totals).

## Data integrity findings (ops)

- Pending Moolre orders ≠ unpaid money — many are abandoned checkouts (`SS07` not found).
- Admin browse previously hid orders older than newest 500 — fixed via search + load-more.
