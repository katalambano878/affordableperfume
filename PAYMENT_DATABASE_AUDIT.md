# Payment Database Audit

## Gateways

| Gateway | Status |
|---------|--------|
| **Moolre** | Implemented (initiate, callback, verify, reconcile) |
| Hubtel | **N/A — not implemented** |
| Paystack | **N/A — not implemented** |

## Tables

### `orders` (existing)

Trusted total, `payment_status`, `payment_method`, `payment_provider`, `payment_transaction_id`, `metadata` (legacy refs).

### `payment_attempts` (new)

| Column | Role |
|--------|------|
| `internal_ref` | Unique Moolre externalref (`ORD-…-R{ts}`) |
| `gateway_ref` | Moolre transaction id |
| `expected_amount` / `amount_paid` | Amount integrity |
| `currency` | `GHS` |
| `status` | initiated → successful / failed / … |

### `payment_callback_events` (new)

| Column | Role |
|--------|------|
| `payload_hash` | Unique with gateway — idempotency |
| `external_event_id` | Moolre txn id (unique when present) |
| `processing_status` | received / processed / rejected / ignored_duplicate / error |
| `signature_valid` | Callback secret check result |

## Moolre flow

1. **Initiate** (`/api/payment/moolre`) — amount from DB; write `moolre_payment_ref`; insert `payment_attempts`
2. **Callback** — secret check; record event; reject dup hash; require amount match; `mark_order_paid`; mark attempt successful; SMS/email once
3. **Verify / reconcile** — status API; amount required; dual-write attempt success

## Integrity rules

- Never trust client amount
- Never mark paid from redirect alone without verify/callback/reconcile
- Duplicate callbacks ignored
- Delayed failure cannot overwrite `paid`
- SMS dedupe via `metadata.confirmation_sent_at` in notifications

## Tests

`lib/payment/moolre.test.ts` — 5/5 pass (`isMoolrePaymentSuccessful` matrix).

## Historical data

540 paid orders with empty `payment_transaction_id` — likely older path / metadata-only refs. Do not mass-update without review. New payments should populate via RPC.
