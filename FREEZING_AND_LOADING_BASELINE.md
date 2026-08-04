# Freezing and Loading Baseline

Captured before / during freeze-hardening (2026-08). Environment: production Postgres `affordableperfume` + Coolify app `affordableperfume-app`.

## Symptoms reported

- Website freezes intermittently
- Admin dashboard / shell stuck on “Loading Admin…” / “Loading Dashboard…”
- Buttons stay disabled after click
- Requests remain pending
- Admin stats/tables never load (especially tablet/PWA)

## Architecture (actual)

| Layer | Implementation |
|-------|----------------|
| Framework | Next.js App Router |
| DB | Plain PostgreSQL via shared `pg` pool (`lib/db/pool.ts`) |
| Client data | supabase-js shim → `/rest` + `/auth` |
| Payments | Moolre only (Hubtel/Paystack not integrated) |
| SMS | Moolre SMS |
| Deploy | Coolify / Docker on VPS |

## High-risk findings (pre-fix)

| Area | Issue | Impact |
|------|--------|--------|
| `app/admin/layout.tsx` | Profile fetch without try/finally; effect deps `[pathname, router]` | Endless “Loading Admin…”; re-auth every nav |
| `app/admin/page.tsx` | Selected **all** orders into browser for stats | Hang/memory as orders grow (~1400+) |
| Admin login | reCAPTCHA execute could hang; loading outside single finally | Login button stuck |
| Admin orders (tablet) | Bearer-only APIs + swallowed errors | Zeros / empty tables (fixed earlier `f8dcf6d`) |
| Customer insights / analytics | Unbounded client selects | Main-thread freeze risk |
| Payment reconcile | No fetch timeout; required Bearer | Stuck busy / auth miss |

## Measured / observed (staging-prod)

| Metric | Baseline observation |
|--------|----------------------|
| Orders table size | ~1400+ rows |
| Admin dashboard data path | Full table client fetch (unbounded) |
| PG pool | Shared; `statement_timeout` default 30s; connect timeout 10s |
| Moolre status | 15s AbortSignal timeout already present |
| Health | `/api/health/db` available |

Exact wall-clock timings vary by device/network; primary defect was **unbounded work + missing failure cleanup**, not a single slow query.

## Screenshot / log notes

- Tablet: admin orders showed 0 counts while DB had data (cookie-only session).
- Server logs: Moolre SMS `ASMS06` insufficient balance (ops, not freeze root cause).
