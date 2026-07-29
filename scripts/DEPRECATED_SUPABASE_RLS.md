# Deprecated: hosted Supabase RLS scripts

The following scripts target the **old hosted Supabase project** and must **not** be run against production plain Postgres:

- `scripts/apply-rls.mjs`
- `scripts/apply-rls-direct.mjs`
- `scripts/enable-rls.sql` (if present)

Plain-PG security is application-layer (middleware JWT, API `verifyAuth`, REST write field stripping). RLS via `auth.uid()` does not apply to the shim.

If you need these files for historical reference, leave them unused.
