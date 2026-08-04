# External Service Timeout Report

## Moolre payment

| Item | Value |
|------|-------|
| Initiate (`/api/payment/moolre`) | `AbortSignal.timeout(20000)` |
| Status check (`lib/payment/moolre.ts`) | 15000 ms |
| Admin reconcile (client) | 25s GET / 45s single POST / 120s bulk |
| Error handling | JSON error responses; client busy cleared in `finally` |
| Retry | Manual admin only; no unbounded auto-retry |
| Idempotency | Callback events + payment attempt records |
| Blocks page loading? | **No** on dashboard. Checkout waits for initiate (capped 20s). Reconcile only when opened |

## Hubtel payment

Not integrated in this repository. N/A.

## Paystack payment

Not integrated in this repository. N/A.

## Moolre SMS

| Item | Value |
|------|-------|
| Send (`lib/notifications.ts`) | 15000 ms |
| Admin test SMS | 15000 ms |
| Duplicate prevention | Application-level notification / order flows (callback idempotency separate) |
| Retry | Controlled by caller; no infinite loop |
| Background | Prefer record-then-send; callback path should not block on SMS (existing design) |
| Blocks dashboard? | **No** |
| Blocks callbacks? | Keep SMS outside critical path; insufficient balance (`ASMS06`) is ops |

## reCAPTCHA

| Client execute | 8s |
| Server verify Google | 10s |
| Hook → `/api/recaptcha/verify` | 10s |
| Failure | Login button re-enabled via `finally` |

## Failure behavior summary

Timeouts surface as AbortError → user-visible message + retry. Gateways never contacted during admin dashboard KPI load.
