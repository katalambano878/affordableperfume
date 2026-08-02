# Database Audit and Repair Report — Affordable Perfumes GH

**Date:** 2026-08-02  
**Target DB:** PostgreSQL 16.14 · database `affordableperfume` · host `fleet-postgres` (Coolify)  
**Environment note:** Prompt labeled “staging”; connected DB is the **live production** database behind affordableperfumesgh.com. Repairs were **additive / reversible only**.

## 1. Architecture

| Item | Value |
|------|--------|
| Engine | PostgreSQL 16.14 |
| Library | `pg` + `@supabase/supabase-js` shim |
| ORM | None (no Prisma/Drizzle) |
| Compat | `lib/db/supabase-compat.ts` |
| Pool | `lib/db/pool.ts` (max 10, connect/statement timeouts) |
| Auth | `auth.users` + JWT (`lib/db/auth.ts`) |
| Storage | Local disk (`lib/db/storage.ts`) |
| Payments | **Moolre only** |
| Migration tracker | `public.schema_migrations` + `scripts/sql/migrations/*` |

## 2. Baseline inventory (pre-repair)

| Metric | Value |
|--------|------:|
| Public tables | 31 |
| Auth tables | `auth.users` |
| FKs | 35 |
| Indexes | 81+ |
| Orders | 1286 |
| Order items | 4513 |
| Products | 333 |
| Customers | 579 |
| Profiles / auth.users | 236 / 236 |
| Paid orders | 540 |
| Orphan order_items | 0 |
| Duplicate order_numbers | 0 |
| Profiles↔users orphans | 0 |
| `contact_submissions` | **Missing** |
| Payment attempt tables | **Missing** |

## 3. Schema-drift matrix (summary)

| Object | Code | Dump SQL | Live (before) | Problem | Repair |
|--------|------|----------|---------------|---------|--------|
| `contact_submissions` | Contact form | Absent | Missing | Inserts failed silently | Created `001_*` |
| `wholesale_applications` | Wholesale/admin | Absent from dump | Present | Dump drift | Documented; live OK |
| `payment_attempts` | Needed for integrity | Absent | Missing | Weak payment audit | Created `002_*` |
| `payment_callback_events` | Needed for idempotency | Absent | Missing | Dup callbacks hard to prove | Created `003_*` |
| `schema_migrations` | None | Absent | Missing | No migration history | Created `000_*` |
| REST open tables | Any name | — | Open | Post-RLS exposure | Positive allowlist |
| REST open RPC | Any fn | — | Open | `mark_order_paid` public | Allowlist + admin auth |
| Hubtel/Paystack tables | Prompt | N/A | N/A | Not implemented | Document N/A |

## 4. Repairs completed

- Additive migrations `000`–`005` applied and recorded in `schema_migrations`
- GRANTs to role `affordableperfume`
- Moolre initiate/callback/reconcile dual-write to payment tables
- Callback duplicate detection via payload hash unique index
- Delayed failure cannot overwrite paid orders
- REST read/write allowlists; RPC allowlists
- Pool connection + statement timeouts
- `/api/health/db` safe health endpoint
- `.env.example` added
- Contact form no longer fakes success on insert failure
- Unit tests for `isMoolrePaymentSuccessful` (5/5 pass)

## 5. Data findings (not auto-destructive)

| Finding | Count | Action |
|---------|------:|--------|
| Paid orders with empty `payment_transaction_id` | 540 | Manual review / backfill from metadata later — **not wiped** |
| Negative totals | 0 | OK |
| Orphans | 0 | OK |

## 6. Remaining risks

1. REST CORS still `*` (supabase-js browser clients).
2. Historical paid rows may lack `payment_transaction_id`; new paid path should populate via `mark_order_paid`.
3. Hubtel/Paystack not in codebase.
4. Admin client components still use REST for many writes (mitigated by allowlist + field strips).

## 7. Build / deploy

See final readiness in agent response after deploy confirmation.
