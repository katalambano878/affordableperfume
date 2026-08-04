# Performance Changelog (Freeze / Endless Loading Hardening)

## Files changed

- `app/admin/layout.tsx` — auth timeout, finally, error/retry, login-vs-protected deps
- `app/admin/page.tsx` — summary API + timeout + error UI
- `app/api/admin/dashboard/summary/route.ts` — **new** SQL aggregates
- `lib/fetch-with-timeout.ts` — **new**
- `lib/recaptcha.ts`, `hooks/useRecaptcha.ts` — timeouts
- `app/admin/login/page.tsx` — single try/finally for loading
- `app/admin/orders/page.tsx` — timed fetches
- `app/admin/payments/reconcile/page.tsx` — credentials + timeouts
- `app/admin/analytics/page.tsx` — order limit
- `app/admin/customer-insights/page.tsx` — select caps
- `app/admin/customers/page.tsx` — limits
- `app/api/payment/moolre/route.ts` — initiate timeout
- `app/admin/test-sms/actions.ts` — SMS timeout + catch log
- Docs: `FREEZING_*`, `DATABASE_*`, `ADMIN_*`, `EXTERNAL_*`, `WEBSITE_STABILITY_CHECKLIST.md`

## Queries changed

- Dashboard stats: client full scan → server `COUNT/SUM/FILTER` + 7-day chart group by day

## Indexes added

- None in this pass (prior concurrent indexes remain)

## Components changed

- Admin shell, dashboard, orders, reconcile, login, analytics, insights, customers

## APIs changed

- Added `GET /api/admin/dashboard/summary`
- Moolre initiate timeout

## Timeouts added

- Profile 12s; dashboard/orders/search/reconcile/recaptcha/Moolre/SMS as documented

## Error boundaries

- Admin auth error panel + dashboard Retry (route-level `error.tsx` still recommended for deeper isolation)

## Tests added

- Manual / checklist coverage; automated freeze suite not added in this pass

## Before / after

| Area | Before | After |
|------|--------|-------|
| Admin shell hang | Possible forever | ≤12s then error/retry or redirect |
| Dashboard payload | All orders | Aggregates + small lists |
| Login stuck verifying | Possible | ≤~10s paths + finally |
| Reconcile pending | Possible forever | Timed abort + message |
