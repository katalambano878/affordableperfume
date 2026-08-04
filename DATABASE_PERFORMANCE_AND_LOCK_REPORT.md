# Database Performance and Lock Report

## Connection architecture

- Single shared `pg.Pool` in `lib/db/pool.ts` (module singleton)
- Used by REST shim, admin SQL routes, payment records, health checks
- Not imported into Client Components

## Pool settings

| Setting | Source | Default |
|---------|--------|---------|
| `max` | `PG_POOL_MAX` | 10 |
| `connectionTimeoutMillis` | `PG_CONNECTION_TIMEOUT_MS` | 10000 |
| `idleTimeoutMillis` | hard-coded | 30000 |
| `statement_timeout` | `PG_STATEMENT_TIMEOUT_MS` per connect | 30000 |
| SSL | `PGSSL=require` optional | off |

## Connection leaks

- No per-request `new Pool()` found in app paths
- Manual `pool.connect()` paths use try/finally release in payment/transaction helpers (prior hardening)

## Open transactions / locks

- Staging/prod monitoring: use queries in prior DB audit docs / `scripts/sql`
- Payment callbacks use short transactions; external Moolre calls outside long TX (callback idempotency via `payment_callback_events`)

## Slow queries (pre-fix patterns)

| Pattern | Route | Issue | Repair |
|---------|-------|-------|--------|
| `SELECT` all orders columns for stats | Admin dashboard | Full scan to browser | SQL `COUNT/SUM/FILTER` in `/api/admin/dashboard/summary` |
| Unbounded profiles×orders | Customer insights | N×M in browser | Limits 500 / 3000 |
| Orders list without pagination | Admin orders (historical) | Huge payload | Server list API + infinite scroll |

## Missing indexes

- Performance indexes previously applied with `CREATE INDEX CONCURRENTLY` (orders payment_status, created_at, etc.) — see prior migration set
- Dashboard summary benefits from `(payment_status, created_at)` style indexes already targeted

## Timeouts

- Statement timeout 30s on pool connections
- Client fetch timeouts 15–25s for admin APIs; Moolre 15–20s

## Before / after (dashboard data path)

| Metric | Before | After |
|--------|--------|-------|
| Rows transferred for dashboard stats | All orders (~1400+) | Aggregate scalars + 5 recent + caps |
| Failure mode | Spinner until browser dies / hangs | JSON error + Retry within ~20s |

## Health

- `GET /api/health/db` — pool connectivity without exposing credentials
