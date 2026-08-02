# Migration Status Report

**Tool:** Custom SQL files + `schema_migrations` table (no Prisma/Drizzle)  
**Runner:** `scripts/apply-sql-migrations-remote.sh` (applies as Postgres superuser on Coolify)  
**Canonical legacy dump:** `supabase/migrations/20260209000000_complete_schema.sql` (historical; not re-run)

## Applied (2026-08-02)

| id | Purpose | Destructive? |
|----|---------|--------------|
| `000_schema_migrations` | Tracker table | No |
| `001_contact_submissions` | Contact form table | No |
| `002_payment_attempts` | Payment attempts | No |
| `003_payment_callback_events` | Callback idempotency | No |
| `004_orders_integrity` | Non-neg checks + txn index | No (conditional CHECKs) |
| `005_supporting_indexes` | Hot-path indexes IF NOT EXISTS | No |

## Pending

None for this repair pass.

## Failed migrations

None.

## Rollback notes

Additive only. Rollback = drop new objects if absolutely required:

```sql
-- ONLY if rolling back this pass (review first)
DROP TABLE IF EXISTS public.payment_callback_events;
DROP TABLE IF EXISTS public.payment_attempts;
DROP TABLE IF EXISTS public.contact_submissions;
-- Keep schema_migrations history or delete specific ids
DELETE FROM public.schema_migrations WHERE id LIKE '00%';
```

Do **not** drop `orders` / core commerce tables.

## Deployment order

1. Apply SQL migrations (done on prod 2026-08-02)
2. Deploy app code that dual-writes payment tables + REST allowlists
3. Confirm `/api/health/db` → `healthy`
