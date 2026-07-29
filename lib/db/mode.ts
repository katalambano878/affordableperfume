/**
 * Plain-Postgres mode is active when DATABASE_URL is set.
 */
export function isPlainPostgres(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

/**
 * Prefer local JWT verification when cut over to plain Postgres.
 * - Explicit: NEXT_PUBLIC_USE_PLAIN_PG=true
 * - Fail-closed: DATABASE_URL / POSTGRES_URL present (Coolify injects into the app process)
 * Hosted Supabase service-role middleware only when neither applies.
 */
export function usePlainPostgresAuth(): boolean {
  if (process.env.NEXT_PUBLIC_USE_PLAIN_PG === 'true') return true;
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return true;
  return false;
}

export function authJwtSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "dev-auth-secret-change-me"
  );
}
