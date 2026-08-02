# Database Recovery Guide

**Database:** `affordableperfume` on Coolify `fleet-postgres`  
**Never expose credentials in tickets or commits.**

## 1. Export schema

```bash
# On VPS (as operator with docker access)
sudo docker exec fleet-postgres pg_dump -U postgres -d affordableperfume --schema-only \
  > /tmp/affordableperfume-schema-$(date +%F).sql
```

## 2. Export data (full)

```bash
sudo docker exec fleet-postgres pg_dump -U postgres -d affordableperfume \
  --format=custom -f /tmp/affordableperfume-$(date +%F).dump
```

Copy artifact off-box securely.

## 3. Export critical tables only

```bash
sudo docker exec fleet-postgres pg_dump -U postgres -d affordableperfume \
  -t orders -t order_items -t customers -t profiles -t payment_attempts \
  -t payment_callback_events --data-only \
  > /tmp/affordable-critical-$(date +%F).sql
```

## 4. Restore (destructive — confirm target DB first)

```bash
# Custom format
sudo docker exec -i fleet-postgres pg_restore -U postgres -d affordableperfume --clean --if-exists \
  < /tmp/affordableperfume-YYYY-MM-DD.dump
```

Prefer restore onto a **new database name** first, then cut over.

## 5. Migration rollback (this repair pass)

See `MIGRATION_STATUS_REPORT.md`. Drop only new tables if needed; never drop `orders`.

## 6. Verify after restore

```sql
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM order_items;
SELECT id FROM schema_migrations ORDER BY applied_at;
```

Hit `GET /api/health/db` → expect `{ "status": "healthy" }`.

## 7. Payment / SMS after restore

- Confirm Moolre callback URL still points at production app
- Reconcile pending paid-but-unmarked via `/admin/payments/reconcile`
- Do not re-blast SMS; check `metadata.confirmation_sent_at`

## 8. Row-count snapshot (audit day)

| Table | Approx |
|-------|-------:|
| orders | 1286 |
| order_items | 4513 |
| products | 333 |
| customers | 579 |
| profiles | 236 |
