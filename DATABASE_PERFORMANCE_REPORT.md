# Database Performance Report

**Date:** 2026-08-02

## Connection pool

| Setting | Value |
|---------|-------|
| Max clients | `PG_POOL_MAX` default 10 |
| Idle timeout | 30s |
| Connection timeout | `PG_CONNECTION_TIMEOUT_MS` default 10s |
| Statement timeout | `PG_STATEMENT_TIMEOUT_MS` default 30s (SET on connect) |

Single shared pool in `lib/db/pool.ts` — not imported by browser code.

## Indexes (justified / applied)

| Index | Purpose |
|-------|---------|
| `orders_order_number_key` / `idx_orders_order_number` | Payment + track |
| `idx_orders_email_lower` | Admin search |
| `idx_orders_tracking_number` | Track by SLI |
| `idx_order_items_order_id` | Embeds |
| `idx_orders_payment_status_created` | Pending browse |
| `idx_orders_payment_transaction_id` | Gateway lookup |
| `idx_customers_email_lower` | CRM / newsletter |
| `idx_payment_attempts_internal_ref` | Idempotent attempts |
| `idx_payment_callback_events_gateway_hash` | Callback dedupe |

## Application query improvements (already / this pass)

- Admin order stats: server SQL aggregates (`/api/admin/orders/stats`) — not client-only counts
- Admin orders: infinite scroll pages of 100 (not unbounded 500)
- Admin search: server ILIKE with limit 50
- Moolre status/SMS: 15s AbortSignal timeouts

## Slow-path candidates (monitor)

- Admin analytics loading large `order_items` sets
- Shop count + filter combinations
- Dashboard homepage multi-query waterfalls

Use `EXPLAIN (ANALYZE, BUFFERS)` on staging/copy before adding more indexes.

## Freezing contributors (DB-related)

| Cause | Mitigation |
|-------|------------|
| Pool exhaustion | Shared pool + timeouts |
| Unbounded admin select | Pagination / search |
| External API hang inside request | Fetch timeouts |
| SW HTML cache | Separate (not DB) |
