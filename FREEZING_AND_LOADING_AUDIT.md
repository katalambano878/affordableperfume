# Freezing and Loading Audit

## Pages inspected

- Public storefront (home, products, cart, checkout, order-success)
- Admin shell (`app/admin/layout.tsx`) + login
- Admin dashboard, orders, products, customers, analytics, customer-insights, inventory, payments/reconcile, POS, modules, settings, SMS test
- API: admin list/stats/search/dashboard summary, Moolre payment/callback/verify/reconcile, health/db, notifications, recaptcha

## Infinite loading states found

1. **Admin layout** — profile await without try/finally; hung REST → permanent “Loading Admin…”
2. **Admin layout effect** — `[pathname, router]` re-ran session on every route change
3. **Admin dashboard** — unbounded orders select → long/never-finishing client work
4. **Login + reCAPTCHA** — execute/verify could hang; loading not always cleared via one finally path
5. **Reconcile / orders fetches** — no AbortSignal timeout on client

## React loops found

- Admin auth effect tied to full `pathname` (re-subscribe / re-handleSession every nav) — **fixed** (depends on `isLoginPage` only)
- No confirmed Strict Mode–only infinite render loops after fix

## Pending requests found

- Dashboard full-table REST select under slow `/rest`
- Orders/stats without timeout (tablet hung visually when JSON/error swallowed earlier)

## Redirect loops found

- None confirmed. Middleware currently sets headers on `/api/*` and does not force login redirects on callbacks.
- Risk: if middleware later adds auth to all `/api/*`, Moolre callbacks would break — document as landmine

## External blocking calls found

- Dashboard did **not** call payment gateways (good)
- Reconcile page **does** call Moolre (explicit admin action — correct)
- SMS not on dashboard load; OTP/notification paths use 15s timeout

## Root causes

1. Missing loading cleanup / timeouts on admin auth
2. Client-side aggregation over entire `orders` table
3. Unbounded admin list selects (insights/analytics/customers)
4. Cookie vs Bearer auth gaps (prior fix) causing “empty forever” UX
5. Service worker cache-first JS (prior fix → network-first v2.3)

## Fixes applied

- Admin layout: timeout + try/finally + auth error/retry UI; auth deps = login vs protected only
- `/api/admin/dashboard/summary` SQL aggregates; dashboard client uses `fetchWithTimeout`
- `lib/fetch-with-timeout.ts`; orders/reconcile/recaptcha timeouts
- Caps on analytics / customer-insights / customers
- Moolre initiate + test-sms AbortSignal timeouts
- Login loading always cleared in `finally`

## Remaining risks

- Analytics still loads up to 3000 paid orders client-side (capped, not SQL aggregates)
- Customers page still merges up to 5k orders client-side
- Inventory/products pages may still load large catalogs — review if catalogs grow past ~2k SKUs
- Hubtel/Paystack: N/A
