/**
 * Plain-Postgres mode is active when DATABASE_URL is set.
 * Production keeps using hosted Supabase until cutover.
 */
export function isPlainPostgres(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

/**
 * Edge middleware cannot use the pg pool — use the public cutover flag.
 * On VPS/cutover, set NEXT_PUBLIC_USE_PLAIN_PG=true together with DATABASE_URL.
 */
export function usePlainPostgresAuth(): boolean {
  return process.env.NEXT_PUBLIC_USE_PLAIN_PG === 'true';
}

export function authJwtSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "dev-auth-secret-change-me"
  );
}
