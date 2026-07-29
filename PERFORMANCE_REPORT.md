# Performance Report

**Project:** Affordable Perfumes GH  
**Date:** 2026-07-29  

## Baseline findings

| Area | Issue | Mitigation |
|------|-------|------------|
| Admin orders | Hard `.limit(500)` — older orders invisible | Server search + load-more browse |
| Shop | Content-Range / remount jumps | Fixed earlier (playbook §5) |
| PWA | Stale HTML shell → white screen | SW network-only navigations |
| External APIs | Moolre/SMS could hang | Fetch timeouts (SMS + status) |
| DB | Likely hot paths without expression indexes | Suggested indexes below |

## Freezing / slowness causes (confirmed historically)

1. Service worker caching HTML after deploy.
2. Shop grid remount when categories resolved mid-scroll.
3. Admin loading huge pages without pagination.
4. Payment verify hitting wrong/non-JSON status endpoint (fixed → `/open/transact/status`).

## Recommended indexes (apply carefully on prod)

See `scripts/sql/performance_indexes_orders.sql`. Prefer `CREATE INDEX CONCURRENTLY` outside a transaction.

| Index | Purpose |
|-------|---------|
| `orders(order_number)` | Track + payment lookup |
| `(metadata->>'tracking_number')` | Track by SLI-* |
| `order_items(order_id)` | Embed / invoice |
| `lower(email)` on orders | Admin search |

## Bundle / rendering

- Prefer server components where already used; avoid new large client providers.
- Images: `unoptimized` if sharp broken on Coolify (playbook §2).

## Before / after (this pass)

| Metric | Before | After |
|--------|--------|-------|
| Admin find order #522 | Impossible without DB | Search + load-more |
| SMS hang risk | No timeout | AbortSignal timeout |
| Provider mark-paid without amount | Allowed | Rejected |

## Index apply notes

SQL: `scripts/sql/performance_indexes_orders.sql`  
Apply one `CREATE INDEX CONCURRENTLY` at a time on prod (not inside a transaction). Optional until EXPLAIN shows seq scans on hot paths.
