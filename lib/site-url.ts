/** Public site origin (no path). Fixes DB values like `https://example.com/shop`. */
export function normalizePublicOrigin(url?: string | null): string {
  const fallback = 'https://www.affordableperfumesgh.com';
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const raw = (env || url || fallback).trim();
  if (!raw || raw === 'https://example.com') return fallback;

  try {
    const withProtocol = raw.includes('://') ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return raw.replace(/\/+$/, '').replace(/\/shop$/i, '');
  }
}

/** Turn a storage path or relative URL into an absolute public URL. */
export function toAbsolutePublicUrl(
  pathOrUrl: string | null | undefined,
  origin?: string
): string {
  if (!pathOrUrl?.trim()) return '';
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const base = (origin || normalizePublicOrigin()).replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

/** Supabase shim base URL — must be origin only (PostgREST lives on same host). */
export function resolveSupabaseShimOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return normalizePublicOrigin(fromEnv);
  return normalizePublicOrigin();
}
