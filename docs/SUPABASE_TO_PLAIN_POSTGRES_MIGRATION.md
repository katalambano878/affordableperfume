# Supabase → Plain Postgres Migration Playbook

A complete, reusable guide for migrating a Next.js (App Router) app off hosted Supabase
onto a self-hosted plain PostgreSQL + local file storage stack, deployed with Coolify.

This is the exact process used to migrate **Affordable Perfumes GH**
(Vercel + Supabase → big-vps + fleet-postgres) in July 2026. It was done
staging-first, verified, then cut over to production with zero data loss.

---

## 1. The Big Picture

Supabase gives you 4 things your app depends on:

| Supabase service | What replaces it |
|---|---|
| Postgres + PostgREST (`supabase.from(...)`) | In-process query builder over `pg` + `/rest/v1/[table]` API routes |
| GoTrue auth (`supabase.auth.*`) | bcrypt + JWT shim (`lib/db/auth.ts`) + `/auth/v1/[...path]` API routes |
| Storage (`supabase.storage.*`) | Local-disk shim (`lib/db/storage.ts`) + `/storage/v1/object/...` API routes |
| RPC (`supabase.rpc(...)`) | Direct `SELECT fn(args)` + `/rest/v1/rpc/[fn]` API route |

**Key design decision:** don't rewrite app code. Build a compatibility layer so the
existing `supabase.from(...).select(...).eq(...)` calls keep working unchanged:

- **Server-side code** gets an in-process client (direct `pg` pool — no HTTP hop).
- **Browser-side code** keeps using `@supabase/supabase-js`, but pointed at your own
  domain, where Next.js API routes emulate the PostgREST / GoTrue / Storage HTTP APIs.

Mode switching is env-driven so production can stay on Supabase until you cut over:

```ts
// lib/db/mode.ts
export function isPlainPostgres(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
```

Set `DATABASE_URL` → plain Postgres mode. Unset → hosted Supabase. Nothing else changes.

---

## 2. File Layout of the Compatibility Layer

```
lib/db/
  mode.ts            # isPlainPostgres(), authJwtSecret()
  pool.ts            # shared pg Pool + type parsers
  fk-map.ts          # FK relationships for PostgREST-style embeds (per project!)
  supabase-compat.ts # QueryBuilder: from/select/insert/update/upsert/delete/filters/embeds/rpc
  auth.ts            # GoTrue shim: signIn/signUp/refresh/verify/getUser (bcrypt + jose)
  storage.ts         # Storage shim: upload/remove/getPublicUrl/createSignedUrl/readObject

app/
  rest/v1/[table]/route.ts            # PostgREST HTTP emulation (GET/POST/PATCH/DELETE)
  rest/v1/rpc/[fn]/route.ts           # RPC over HTTP
  auth/v1/[...path]/route.ts          # GoTrue HTTP emulation (token/signup/user/logout)
  storage/v1/object/[bucket]/[...path]/route.ts          # upload/delete
  storage/v1/object/public/[bucket]/[...path]/route.ts   # serve public files
  storage/v1/object/sign/[bucket]/[...path]/route.ts     # serve signed files
```

Existing entry points get a mode switch:

```ts
// lib/supabase-admin.ts  (server-side, service-role equivalent)
function createAdminClient() {
  if (isPlainPostgres()) return createPgClient();          // in-process pg compat
  return createSupabaseJsClient(url, serviceKey, {...});   // hosted Supabase
}

// lib/supabase.ts (browser) — unchanged! It reads NEXT_PUBLIC_SUPABASE_URL,
// which you simply point at your own domain in plain-PG mode.
```

`middleware.ts` also branches: in plain-PG mode it verifies your own JWTs with `jose`
instead of calling Supabase's `auth.getUser()`.

### 2.1 Dependencies to add

```
npm i pg bcryptjs jose
npm i -D @types/pg @types/bcryptjs dotenv-cli
```

### 2.2 pg Pool — type parsers matter

supabase-js returns dates/numerics as strings/numbers in specific formats. Match them
or subtle bugs appear:

```ts
types.setTypeParser(1082, (v: string) => v);                       // date -> "YYYY-MM-DD"
types.setTypeParser(1114, (v: string) => v?.replace(" ", "T"));    // timestamp -> ISO-ish
types.setTypeParser(1184, (v: string) => {                         // timestamptz
  if (!v) return v;
  return v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");     // "+00" -> "+00:00"
});
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric -> number
types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10))); // int8 -> number
```

### 2.3 The FK map (project-specific — regenerate per project)

PostgREST embeds (`products(name, product_images(url))`) need FK knowledge. Generate it
from the live Supabase DB:

```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
```

Also list the **jsonb columns** per table (needed for correct value serialization):

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND udt_name='jsonb';
```

Write both into `lib/db/fk-map.ts` as `FK_MAP` and `JSONB_COLUMNS`.

### 2.4 Query builder — supported surface

Audit your codebase first (`grep -r "supabase\." --include="*.ts*"`) and implement
exactly what's used. For this project that was:

- `.select(cols, { count, head })` incl. embeds `alias:table(cols)`, `table!fk_constraint(cols)`, reverse embeds
- `.insert / .update / .upsert(onConflict) / .delete` with `.select()` → `RETURNING`
- `.eq .neq .gt .gte .lt .lte .like .ilike .is .in .or(...) .not(col, 'in'|'is', v) .filter`
- `.order .limit .range .single .maybeSingle`
- `rpc(fn, namedArgs)` → `SELECT public.fn(a := $1, ...)`

Safety rules that made it robust:

- **Identifier allowlist**: every table/column/function name must match
  `/^[a-z_][a-z0-9_]*$/i` before being quoted into SQL. Values always go through
  parameter placeholders — never interpolated.
- **jsonb columns**: `JSON.stringify()` any JS value bound to a jsonb column
  (PostgREST does this implicitly; `pg` does not).
- **`.single()` semantics**: 0 rows → error `PGRST116`; >1 rows → error. `maybeSingle()`:
  0 rows → `data: null`, >1 rows → error. Match PostgREST exactly — app code checks these.

### 2.5 Auth shim essentials

Supabase stores bcrypt hashes in `auth.users.encrypted_password` — **they migrate as-is**
and `bcryptjs.compareSync()` verifies them. Users keep their passwords.

- Access token: HS256 JWT, `sub` = user id, plus `email`, `app_metadata` (put the app
  role here — e.g. from your `profiles.role` — so middleware can authorize without a DB hit),
  `user_metadata`, `session_id`.
- Refresh token: HS256 JWT with `typ: "refresh"`.
- Sign-up: insert into `auth.users` (bcrypt hash, `email_confirmed_at = now()`), then
  create the `profiles` row your app expects.
- Use a **fresh JWT secret** per environment. Old Supabase sessions die at cutover
  (users just log in again) — that's fine and safer than reusing Supabase's secret.

### 2.6 Storage shim essentials

- Files live under `STORAGE_ROOT/<bucket>/<path>`, with a small `<path>.meta.json`
  alongside for content-type.
- Public URL: `STORAGE_PUBLIC_URL + /storage/v1/object/public/<bucket>/<path>` —
  same shape as Supabase, so stored URLs only need the host part rewritten.
- Signed URLs: HMAC over `bucket/path/exp` with a signing secret, verified by the
  `sign` route. Path traversal check: resolve and ensure the target stays under
  `STORAGE_ROOT`.

---

## 3. Data Migration

### 3.1 Dump from Supabase

Public tables via PostgREST with the service key (paginated, 1000/page) — see
`migration-artifacts/dump_fresh.js`. Produces one JSON file per table + `_inventory.json`
with row counts.

Auth users **with password hashes** need SQL (the REST API hides `encrypted_password`).
Via Supabase MCP / SQL editor:

```sql
SELECT json_agg(t) FROM (
  SELECT id, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at,
         created_at, updated_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data,
         banned_until, role, is_sso_user, is_anonymous
  FROM auth.users WHERE deleted_at IS NULL
) t;
```

Storage files: `POST /storage/v1/object/list/<bucket>` with the service key to list,
then download each object. Keep the bucket/path structure on disk.

Schema: use your repo's migration SQL, or `pg_dump --schema-only` from Supabase.
Strip Supabase-specific bits (see 3.3).

### 3.2 Prepare the target DB

```bash
# On the Postgres host
psql -U postgres -c "CREATE ROLE myapp LOGIN PASSWORD '<random-31-chars>';"
psql -U postgres -c "CREATE DATABASE myapp OWNER myapp;"
```

Apply an **auth bootstrap** before the app schema (`01_auth_bootstrap.sql`): create the
`auth` schema, a minimal `auth.users` table matching Supabase's columns, stub
`auth.uid()` / `auth.role()` / `auth.jwt()` functions (schema DDL references them), and
the enum types the schema needs. Grant the app role usage on both schemas.

### 3.3 Restore (see `migration-artifacts/restore_staging.py`)

Order of operations that worked:

1. Apply auth bootstrap, then the public schema (with `ON_ERROR_STOP=0` — some
   Supabase-specific statements like RLS policies referencing `auth.uid()` may fail; fine).
2. **Disable RLS on all public tables** — the app connects as one trusted role now;
   authorization moved into the app/middleware:
   ```sql
   DO $$ DECLARE r record; BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public'
     LOOP EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename); END LOOP;
   END $$;
   ```
3. Load `auth.users` (hashes intact), then public tables in FK dependency order with
   `SET session_replication_role = replica;` wrapped around the loads (skips FK/trigger
   enforcement during bulk insert) and `ON CONFLICT DO NOTHING` for idempotency.
4. When generating INSERTs from JSON: cast jsonb columns with `::jsonb`, arrays with a
   proper Postgres array literal, skip dump columns that don't exist in the target schema.
5. Grant the app role everything on `public` + read/write on `auth`.
6. **Rewrite storage URLs** stored in data:
   ```sql
   UPDATE product_images SET url = replace(url, 'https://<ref>.supabase.co', '')
   WHERE url LIKE '%supabase.co%';
   -- repeat for every table/column that stores storage URLs (incl. jsonb settings)
   ```
   Leaving them host-relative (`/storage/v1/object/public/...`) makes them work on any domain.
7. Verify row counts against `_inventory.json`.

---

## 4. Environment Variables

```bash
# Mode switch — presence of DATABASE_URL activates plain-PG mode
DATABASE_URL=postgresql://myapp:<pw>@fleet-postgres:5432/myapp

# Point supabase-js (browser) at YOUR OWN domain — the API routes take over
NEXT_PUBLIC_USE_PLAIN_PG=true
NEXT_PUBLIC_SUPABASE_URL=https://www.myapp.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key        # placeholder; shims don't check it
SUPABASE_SERVICE_ROLE_KEY=local-service-key         # placeholder
NEXT_PUBLIC_APP_URL=https://www.myapp.com

# Auth + storage
AUTH_JWT_SECRET=<openssl rand -hex 32>              # NEW secret per environment
JWT_SECRET=<same>
STORAGE_SIGNING_SECRET=<same or separate>
STORAGE_ROOT=/data/storage
STORAGE_PUBLIC_URL=https://www.myapp.com

NODE_ENV=production
NIXPACKS_NODE_VERSION=20
# ...plus your payment/SMS/email keys unchanged
```

**Critical:** all `NEXT_PUBLIC_*` vars are baked in at **build time**. They must be
present (and correct) during `next build`, and changing them requires a rebuild —
not just a restart.

For local staging dev: put these in `.env.staging`, run via
`dotenv -e .env.staging -- next dev`, and tunnel the DB:
`ssh -L 5433:fleet-postgres:5432 <vps>` (tunnel to the container hostname/IP, not the
host's localhost).

---

## 5. Coolify Deployment (big-vps pattern)

1. Create the app via API (`POST /api/v1/applications/public`) — nixpacks, branch,
   `ports_exposes: 3000`. Ensure `package.json` has `"start": "next start -H 0.0.0.0 -p 3000"`.
2. Set env vars via `POST /api/v1/applications/{uuid}/envs` with
   `is_buildtime: true, is_runtime: true, is_literal: true`.
3. Mount persistent storage (Coolify DB, since the API lacks it):
   ```sql
   INSERT INTO local_persistent_volumes (name, mount_path, host_path, resource_type, resource_id, ...)
   VALUES ('myapp-storage', '/data/storage', '/data/coolify/myapp/storage', 'App\Models\Application', <app_id>, ...);
   ```
4. Set domains: `PATCH /api/v1/applications/{uuid}` with
   `{"domains": "https://myapp.com,https://www.myapp.com,https://myapp.<ip-dashes>.sslip.io"}`.
   The sslip.io domain lets you fully verify **before** touching DNS.
5. Deploy: `POST /api/v1/deploy?uuid=<uuid>&force=true`, poll
   `GET /api/v1/deployments/<deployment_uuid>` until `finished`.

### Verify-then-flip sequence (important)

1. First build with all URL envs set to the **sslip.io temp URL** → full smoke test there.
2. Rebuild with URL envs set to the **real domain** → deep-verify via host-header
   requests: `curl --resolve www.myapp.com:443:<VPS_IP> https://www.myapp.com/...`.
3. Flip DNS (A records for apex + www → VPS IP).
4. Traefik auto-issues Let's Encrypt once DNS resolves. If it keeps serving
   `TRAEFIK DEFAULT CERT` after propagation (it cached failures from before the flip):
   `docker restart coolify-proxy` — certs appeared within ~30s.

Rollback = point DNS back at the old host. Keep Vercel + Supabase untouched until
the new stack has survived real traffic.

---

## 6. Pitfalls We Actually Hit (fix these proactively)

1. **UUID cast errors on `or=(id.eq.X,...)` lookups** ⚠️ *broke checkout in production.*
   PostgREST silently coerces; plain Postgres throws
   `invalid input syntax for type uuid` when code does
   `.or('id.eq.ORD-123,order_number.eq.ORD-123')`. Two fixes applied:
   - In the shim: compare `id`/`*_id` columns as `::text` when the value isn't a UUID.
   - In app code: test the value with a UUID regex and `.eq()` the right column.
   Grep for this pattern before going live: `grep -rn "id\.eq\.\${" app/ lib/`

2. **Coolify duplicates env vars** (one `is_preview=true` + one `is_preview=false` row,
   or genuine key duplicates). Symptom: build fails with missing envs even though the
   API shows them. Fix: dedupe in coolify-db keeping one row per (key, is_preview),
   and ensure every key has an `is_preview=false` row — that's the one production
   builds read. Verify afterwards via `GET .../envs` that values decrypt (non-empty).
   Never UPDATE `environment_variables.value` via SQL — values are encrypted;
   plaintext writes break decryption. DELETE + re-add via API instead.

3. **bcrypt hashes mangled by shell `$` expansion.** Piping
   `ssh host "psql -c \"...'$HASH'...\""` lets the remote shell eat `$2a$10$...`.
   Always pipe SQL via stdin: `printf "UPDATE ..." "$HASH" | ssh host 'docker exec -i pg psql ...'`.

4. **`generateStaticParams` / SSR pages fetching over HTTP at build time.** Pages that
   call supabase-js against `NEXT_PUBLIC_SUPABASE_URL` need that URL reachable *during
   the Docker build and at runtime*. Before DNS flips, the real domain resolves to the
   old host → 404s on those pages. Verify on the temp URL build; accept the brief
   404 window on dynamic pages during DNS propagation (self-heals).

5. **ESLint config drift breaking Coolify builds.** An
   `eslint-disable @typescript-eslint/no-require-imports` comment passed locally but
   failed the Coolify build (rule not present there). Avoid `require()` — use dynamic
   `import()` — and don't rely on disable comments for rules that may not exist in CI.

6. **`lower(enum_column)` fails** — Supabase columns using enum/domain types (e.g.
   `user_role`) break `lower(role)`. Cast first: `lower(role::text)`.

7. **Coolify API won't PATCH `fqdn`/volumes on some versions** — fall back to direct
   coolify-db SQL (that's safe for non-encrypted columns like `fqdn`,
   `local_persistent_volumes`).

8. **SSH tunnel to the DB**: tunnel to the Postgres *container* (`fleet-postgres:5432`
   via docker network), not the VPS's localhost — the port isn't published on the host.

---

## 7. Verification Checklist (run all of it, staging AND production)

```bash
U=https://<target>

# Pages: expect 200
for P in / /shop /product/<slug> /cart /admin/login; do curl -s -o /dev/null -w "$P %{http_code}\n" $U$P; done

# Auth: real login works, bad password rejected (400)
curl -s -X POST "$U/auth/v1/token?grant_type=password" -H 'Content-Type: application/json' \
  -d '{"email":"<admin>","password":"<pw>"}'          # expect access_token + role in app_metadata

# REST with embeds
curl -s "$U/rest/v1/products?select=id,name,product_images(url)&limit=2" -H 'apikey: x'

# RPC
curl -s -X POST "$U/rest/v1/rpc/<fn>" -H 'Content-Type: application/json' -d '{...}'

# Storage: expect 200 + correct content-type
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$U/storage/v1/object/public/<bucket>/<file>"

# No leftover Supabase references
curl -s $U/ | grep -c 'supabase\.co'                   # expect 0

# Admin protection: expect 307 → /admin/login
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $U/admin

# DB row counts match the dump inventory
# End-to-end: place a real order / run the app's critical money path!
```

The one thing we skipped in staging — a real payment through checkout — is exactly
where the production bug (pitfall #1) surfaced. **Test the money path end-to-end.**

---

## 8. Order of Operations (condensed runbook)

1. Recon: grep every `supabase.` usage; build the FK map + jsonb map from the live DB.
2. Build `lib/db/*` compat layer + `app/{rest,auth,storage}` API routes on a branch.
3. Create staging DB + storage on the VPS; dump Supabase (tables + auth users + files);
   restore; rewrite storage URLs; disable RLS; set admin roles.
4. Staging Coolify app from the branch, temp sslip.io domain → full checklist + manual
   UI pass **including a real payment**.
5. Merge to main. **Fresh dump** (data changed since step 3). Create production DB +
   storage; restore.
6. Production Coolify app: envs (new JWT secret) → deploy → verify on temp URL →
   rebuild with real-domain envs → host-header verification.
7. Flip DNS. Restart coolify-proxy if Let's Encrypt doesn't issue within ~10 min.
8. Post-cutover checklist on the live domain. Keep old stack as rollback for ≥1 week.

---

## Reference files in this repo

| File | Purpose |
|---|---|
| `lib/db/*.ts` | The entire compatibility layer (copy + adapt fk-map) |
| `app/rest/v1/[table]/route.ts`, `app/rest/v1/rpc/[fn]/route.ts` | PostgREST emulation |
| `app/auth/v1/[...path]/route.ts` | GoTrue emulation |
| `app/storage/v1/object/**` | Storage emulation |
| `middleware.ts` | Dual-mode JWT verification |
| `migration-artifacts/dump_fresh.js` | Supabase full-table dumper |
| `migration-artifacts/restore_staging.py` | Restore script (schema + data + grants) |
| `migration-artifacts/01_auth_bootstrap.sql` | `auth` schema bootstrap |
| `migration-artifacts/PRODUCTION_STATUS.md` | This project's cutover record |
