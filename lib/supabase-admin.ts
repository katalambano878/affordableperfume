import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { isPlainPostgres } from './db/mode';
import { createClient as createPgClient } from './db/supabase-compat';

/**
 * Server-side admin client.
 * - Plain Postgres (DATABASE_URL set): in-process pg compat + auth/storage shims
 * - Otherwise: hosted Supabase service-role client
 *
 * ONLY use in API routes / server actions — never in client components.
 *
 * Lazily initialized so `next build` page-data collection can import this module
 * without requiring runtime env vars.
 */

type AdminClient = ReturnType<typeof createPgClient> | ReturnType<typeof createSupabaseJsClient>;

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export'
  );
}

function createAdminClient(): AdminClient {
  if (isPlainPostgres()) {
    return createPgClient();
  }

  // Production cutover must use DATABASE_URL — do not silently talk to hosted Supabase.
  // Skip during `next build` (env often injected only at container runtime).
  if (
    process.env.NODE_ENV === 'production' &&
    !isBuildPhase() &&
    (process.env.NEXT_PUBLIC_USE_PLAIN_PG === 'true' ||
      process.env.REQUIRE_PLAIN_PG === 'true')
  ) {
    throw new Error(
      'DATABASE_URL is required in production plain-Postgres mode (supabase-admin)'
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    // Build / local without hosted URL: return pg stub (queries need DATABASE_URL).
    if (isBuildPhase() || process.env.NODE_ENV !== 'production') {
      return createPgClient();
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseServiceKey) {
    console.error('CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail');
  }

  console.warn(
    '[supabase-admin] Using hosted Supabase service-role client (DATABASE_URL not set)'
  );

  return createSupabaseJsClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _admin: AdminClient | null = null;

function getAdminClient(): AdminClient {
  if (!_admin) _admin = createAdminClient();
  return _admin;
}

/** Lazy proxy — typed loosely so pg-compat + supabase-js union does not collapse to `never`. */
export const supabaseAdmin: ReturnType<typeof createPgClient> = new Proxy(
  {} as ReturnType<typeof createPgClient>,
  {
    get(_target, prop, receiver) {
      const client = getAdminClient();
      const value = Reflect.get(client as object, prop, receiver);
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value;
    },
  }
);