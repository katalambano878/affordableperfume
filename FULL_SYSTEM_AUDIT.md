# Full System Audit — Affordable Perfumes GH

**Date:** 2026-07-29  
**Environment:** Production (Coolify `affordableperfume-app`) + repo `main`  
**Stack:** Next.js App Router · plain PostgreSQL (`pg` + supabase-js shim) · Moolre payments/SMS  

## 1. Executive baseline (before this hardening pass)

| Check | Status |
|-------|--------|
| Git | `main` @ `214634b` (hardening pass deployed) |
| Architecture | Plain PG via `DATABASE_URL`; browser talks to app `/rest/v1`, `/auth/v1`, `/storage/v1` |
| Hubtel / Paystack | **Not implemented** (proposal only) |
| Known Jul 2026 incidents | Missed Moolre callbacks; wrong status URL; admin 500-order cap; track page items below fold |

### Route inventory

| Surface | Count | Notes |
|---------|------:|-------|
| Storefront `app/(store)/**/page.tsx` | 37 | Public + account + wholesale |
| Admin `app/admin/**/page.tsx` | ~30 | Sidebar-gated modules |
| `app/api/**/route.ts` | 14 | Payments, newsletter, notifications, admin |
| Shims | rest / auth / storage | Plain-PG PostgREST + GoTrue + storage |

### Critical journeys (expected)

| Journey | Primary paths | Status at baseline |
|---------|---------------|-------------------|
| Browse / PDP / cart | `/shop`, `/product/[slug]`, `/cart` | Working (scroll/PWA hardened earlier) |
| Checkout + MoMo | `/checkout` → Moolre → callback/verify | Working with residual amount/SMS gaps |
| Track order | `/order-tracking` | Working; items moved above timeline (`c64e4f8`) |
| Admin find order | `/admin/orders` search API | Search OK; browse still capped at 500 |
| Reconcile | `/admin/payments/reconcile` | Working |

### Security notes (baseline)

- REST shim has **no RLS**; trusted DB role. Mutations were not field-stripped (payment_status writable via client PATCH risk).
- Middleware dual-mode could fall back to hosted Supabase service-role if `NEXT_PUBLIC_USE_PLAIN_PG` unset while `DATABASE_URL` present.
- Scripts `scripts/apply-rls*.mjs` still hardcode old `*.supabase.co` — do not run on prod.

---

## 2. Architecture summary

```
Browser (@supabase/supabase-js)
  → NEXT_PUBLIC_SUPABASE_URL = app origin
  → /rest/v1 | /auth/v1 | /storage/v1
  → lib/db/supabase-compat + pool (pg)
  → PostgreSQL

Payments: Moolre embed/link → callback → mark_order_paid → SMS/email
Backup: order-success verify + admin reconcile (lib/payment/moolre.ts)
```

## 3. Page matrix (critical)

| Page | Status |
|------|--------|
| `/` home | Working |
| `/shop` | Working |
| `/product/[slug]` | Working |
| `/cart` | Working (coupons removed) |
| `/checkout` | Working |
| `/order-success` | Working (verify path) |
| `/order-tracking` | Working / Fixed items UX |
| `/account` + invoice | Working |
| `/admin/login` | Working |
| `/admin/orders` | Fixed search + load-more browse |
| `/admin/payments/reconcile` | Working |
| Hubtel/Paystack UI | N/A |

Full storefront list: about, auth/*, blog, categories, contact, faqs, help, maintenance, offline, pay/[orderId], privacy, pwa-settings, returns*, shipping, support/*, terms, wholesale*, wishlist.

## 4. Critical journey smoke (prod HTTP, 2026-07-29)

| Route | Result |
|-------|--------|
| `/` | 200 |
| `/shop` | 200 |
| `/order-tracking` | 200 |
| `/api/payment/moolre/callback` GET | 200 |
| `/admin/payments/reconcile` | 200 (login-gated UI) |

No live MoMo/SMS during audit. Manual: admin orders search + Load more; reconcile against known paid refs only.

## 5. Remaining risks after this pass

1. Guest checkout still inserts orders via REST (by design of shim) — mitigated by stripping payment fields on `orders` PATCH.
2. CORS `*` on REST remains for supabase-js browser clients.
3. Indexes may need `CREATE INDEX CONCURRENTLY` on live DB (see PERFORMANCE_REPORT / migration SQL).
4. Confirm Coolify env: `NEXT_PUBLIC_USE_PLAIN_PG=true`, `DATABASE_URL`, Moolre secrets.

## 5. Production readiness

**Ready after listed manual actions** — see `REPAIR_CHANGELOG.md`.
