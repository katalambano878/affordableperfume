# Website Stability Checklist

Reusable checklist for Next.js + PostgreSQL storefronts.

## React loops

- [ ] No `useEffect` that sets state also listed in deps without a guard
- [ ] Auth effects do not re-run on every pathname change inside a protected area
- [ ] Intervals/subscriptions cleaned up on unmount
- [ ] No `router.refresh` / `router.push` loops

## Loading cleanup

- [ ] Every async UI path uses `try/catch/finally` to clear loading
- [ ] Timeout paths clear loading
- [ ] Unmount sets `mounted = false` before setState

## API completion

- [ ] Every route returns or throws
- [ ] Malformed JSON handled
- [ ] Auth failures return 401 (not hang)
- [ ] Consistent `{ success, data|error }` where used

## Database pool

- [ ] One shared pool/ORM client
- [ ] No `new Pool()` per request
- [ ] `connect()` always `release()` in `finally`
- [ ] Transactions rollback + release

## Timeouts

- [ ] Client fetch timeouts
- [ ] External API AbortSignal
- [ ] DB statement / connection timeouts
- [ ] User-visible timeout messages

## Query performance

- [ ] Aggregates for dashboards (not full table to browser)
- [ ] EXPLAIN slow paths in staging
- [ ] Indexes match filter/sort columns

## Pagination

- [ ] Admin lists paginated or hard-capped
- [ ] Max page size enforced server-side

## Authentication

- [ ] Cookie and Bearer both accepted where needed
- [ ] Role check failure → login / forbidden, not spinner
- [ ] Session refresh does not loop redirects

## Redirects

- [ ] Middleware excludes payment callbacks / webhooks / health
- [ ] No trailing-slash ping-pong

## Payments

- [ ] Dashboard does not call gateways on load
- [ ] Callbacks idempotent
- [ ] Amounts from DB, not browser
- [ ] Gateway timeouts set

## SMS

- [ ] Not inside long DB transactions
- [ ] Not blocking callback ACK
- [ ] Provider timeout + duplicate guards

## Error boundaries

- [ ] Route `error.tsx` / section Retry
- [ ] Optional cards fail independently when possible

## Monitoring

- [ ] Health endpoint for DB
- [ ] Structured logs with duration (no secrets)
- [ ] Pool / connection usage reviewable

## Tests

- [ ] Auth failure, timeout, invalid JSON, double submit
- [ ] Callback replay
- [ ] Production build succeeds
