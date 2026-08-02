# Supabase → PostgreSQL Database Report

## Matrix

| Supabase Feature | Previous | PostgreSQL Replacement | Status |
|------------------|----------|---------|------------------------|--------|
| PostgREST | Hosted `/rest/v1` | App shim `app/rest/v1` + `supabase-compat` | Working; allowlisted |
| GoTrue Auth | Hosted auth | `app/auth/v1` + `lib/db/auth.ts` + `auth.users` | Working |
| Storage | Supabase buckets | Local disk `lib/db/storage.ts` + `/storage/v1` | Working |
| RLS | Policies on tables | App-layer auth + REST allowlists + field strips | Hardened 2026-08-02 |
| Realtime | Channels | **Not used / N/A** | N/A |
| Edge functions | Deno functions | Next.js API routes | Working |
| RPC | `supabase.rpc` | Compat `callRpc` + allowlisted REST RPC | Working |
| Service role | Service key client | `supabaseAdmin` → pg compat when `DATABASE_URL` set | Fail-closed in prod plain-PG |
| Types | Generated supabase types | Informal TS + runtime | Acceptable |

## Remaining Supabase references (intentional)

- Package `@supabase/supabase-js` as **browser API client** pointed at app origin
- Env names `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` (shim, not hosted project)
- Deprecated scripts `scripts/apply-rls*.mjs` — must not run

## RLS replacement summary

| Control | Implementation |
|---------|----------------|
| Table allowlist | `READ_ALLOW_TABLES` / `WRITE_ALLOW_TABLES` |
| Payment field strip | orders insert/update protected fields |
| Profile role strip | cannot self-elevate via REST |
| Order DELETE deny | REST cannot delete orders/items |
| `mark_order_paid` | Admin JWT required on REST RPC |
| Server money path | callback/verify/reconcile use `supabaseAdmin` |

## Auth migration

- `profiles.id` = `auth.users.id` (0 orphans either side as of audit)
- Middleware uses plain-PG JWT when `DATABASE_URL` or `NEXT_PUBLIC_USE_PLAIN_PG=true`
