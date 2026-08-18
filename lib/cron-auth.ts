import { createHash } from 'crypto';

/**
 * Authorize scheduled jobs from Vercel cron or VPS curl.
 * Accepts CRON_SECRET when set, or sha256(SUPABASE_SERVICE_ROLE_KEY) for server-side callers.
 */
export function verifyCronAuth(request: Request): { ok: boolean; reason?: string } {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return { ok: false, reason: 'missing_bearer' };
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (token === cronSecret) return { ok: true };
    return { ok: false, reason: 'invalid_cron_secret' };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const digest = createHash('sha256').update(serviceKey).digest('hex');
    if (token === digest) return { ok: true };
  }

  return { ok: false, reason: 'invalid_token' };
}
