# Payment and Callback Audit

**Project:** Affordable Perfumes GH  
**Date:** 2026-07-29  

## Gateways

| Gateway | Status |
|---------|--------|
| **Moolre** | Production — initiate, callback, verify, admin reconcile |
| **Hubtel** | N/A — not implemented |
| **Paystack** | N/A — not implemented |

## Moolre flow

1. Checkout creates order (amount from cart/DB).
2. `POST /api/payment/moolre` loads order total from DB; sets `metadata.moolre_payment_ref = {order}-R{ts}`.
3. Customer pays on Moolre hosted link.
4. Moolre `POST /api/payment/moolre/callback` with secret + `data.txstatus` / amount.
5. Server `mark_order_paid` + notifications.
6. Redirect → `/order-success` may call `POST /api/payment/moolre/verify`.
7. Admin `/admin/payments/reconcile` for missed webhooks.

Shared logic: `lib/payment/moolre.ts`.

## Endpoints

| Route | Auth | Notes |
|-------|------|-------|
| `POST /api/payment/moolre` | Public (rate-limited) | Amount from DB only |
| `POST /api/payment/moolre/callback` | Callback secret | Idempotent if already paid |
| `GET /api/payment/moolre/callback` | Public | Health ping |
| `POST /api/payment/moolre/verify` | Public (rate-limited) | Status API `/open/transact/status` |
| `GET/POST /api/admin/payment/moolre/reconcile` | Admin Bearer | Single or bulk pending |

## Status mapping

| Moolre | Internal |
|--------|----------|
| `status=1` + `txstatus=1` / success message | paid → `mark_order_paid` |
| `SS07` / not found | not_paid |
| Amount ≠ order.total | reject / amount_mismatch |
| Missing amount on success payload | **reject auto-mark** (this pass) |

## Amount validation

- Callback: require parseable amount matching `orders.total` (±0.01); reject if missing.
- Reconcile/verify: same via `lib/payment/moolre.ts`.

## Duplicate protection

- `mark_order_paid` + payment_status === paid short-circuit.
- Confirmation SMS/email guarded by `metadata.confirmation_sent_at`.

## SMS (Moolre)

- `lib/notifications.ts` → `https://api.moolre.com/open/sms/send`
- Timeout AbortSignal; duplicate confirmation suppressed.

## Manual ops

- Reconcile UI: `/admin/payments/reconcile`
- Never mark paid from browser redirect alone.
- Confirm Coolify: `MOOLRE_*`, `MOOLRE_CALLBACK_SECRET`, callback URL = `https://www.affordableperfumesgh.com/api/payment/moolre/callback`
