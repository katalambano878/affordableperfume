# Repair Changelog — Full System Hardening

**Date:** 2026-07-29  
**Repo:** katalambano878/affordableperfume  

## Docs added

- `FULL_SYSTEM_AUDIT.md`
- `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md`
- `PAYMENT_AND_CALLBACK_AUDIT.md`
- `PERFORMANCE_REPORT.md`
- `REPAIR_CHANGELOG.md` (this file)
- `scripts/DEPRECATED_SUPABASE_RLS.md`
- `scripts/sql/performance_indexes_orders.sql`
- Updated patterns in `docs/STORE_HARDENING_PLAYBOOK.md` (prior session)

## Code changes

| Area | Files | Change |
|------|-------|--------|
| Dual-mode auth | `lib/db/mode.ts` | Prefer plain-PG JWT when `DATABASE_URL` present |
| Admin client | `lib/supabase-admin.ts` | Lazy init; fail at runtime (not build) if plain-PG required without `DATABASE_URL` |
| REST security | `app/rest/v1/[table]/route.ts` | Strip payment fields on update; deny order DELETE; deny write denylist |
| Moolre amount | `lib/payment/moolre.ts`, callback route | Require amount match before mark-paid; structured logs; status timeout |
| SMS | `lib/notifications.ts` | 15s timeout; `confirmation_sent_at` dedupe |
| Admin orders | `app/admin/orders/page.tsx` | Page size 100 + Load more (beyond old 500 cap) |
| OG / icons | `public/og.png`, `app/icon.png`, `app/apple-icon.png` | Replace `next/og` ImageResponse (Windows build crash) with static assets |

## Prior related commits (already on main)

- `a65b43a` — callback `txstatus` + verify `/open/transact/status`
- `a82f213` / `bcad03e` — admin Moolre reconcile
- `c64e4f8` — admin order search + track page items

## Indexes (manual apply)

Run `scripts/sql/performance_indexes_orders.sql` on prod with `CREATE INDEX CONCURRENTLY` (one statement at a time).

## Manual actions required

1. Confirm Coolify env: `DATABASE_URL`, `NEXT_PUBLIC_USE_PLAIN_PG=true`, `NEXT_PUBLIC_SUPABASE_URL` = site origin, all `MOOLRE_*`.
2. Confirm Moolre dashboard callback URL.
3. Apply performance indexes during low traffic.
4. Do **not** run `scripts/apply-rls*.mjs`.
5. After deploy, confirm image SHA; smoke home/shop/checkout/admin orders search + load more + reconcile.

## Hubtel / Paystack

N/A — not in codebase.

## Production readiness

**Ready after listed manual actions.**
