import { supabaseAdmin } from './supabase-admin';
import { isPlainPostgres } from './db/mode';

/**
 * Shared server-side authentication utilities.
 * Use these in API routes and server actions to verify callers.
 */

export interface AuthResult {
  authenticated: boolean;
  user?: any;
  role?: string;
  error?: string;
}

/** Prefer Authorization bearer; fall back to sb-access-token cookie (admin UI). */
export function extractRequestAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

/**
 * Verify that the request has a valid session
 * and optionally check for admin/staff role.
 */
export async function verifyAuth(
  request: Request,
  options: { requireAdmin?: boolean } = {}
): Promise<AuthResult> {
  const token = extractRequestAccessToken(request);

  if (!token) {
    return { authenticated: false, error: 'Missing authorization token' };
  }

  try {
    if (isPlainPostgres()) {
      const auth = await import('./db/auth');
      const verified = await auth.verifyAccessToken(token);
      if (!verified) {
        return { authenticated: false, error: 'Invalid or expired token' };
      }
      const user = await auth.getUserById(verified.userId);
      if (!user) {
        return { authenticated: false, error: 'Invalid or expired token' };
      }

      if (options.requireAdmin) {
        const role =
          (user.app_metadata?.role as string | undefined) ||
          (await loadProfileRole(user.id));
        if (role !== 'admin' && role !== 'staff') {
          return { authenticated: false, error: 'Admin access required' };
        }
        return { authenticated: true, user, role: role || undefined };
      }

      return { authenticated: true, user };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    if (options.requireAdmin) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return { authenticated: false, error: 'Could not verify user role' };
      }

      if (profile.role !== 'admin' && profile.role !== 'staff') {
        return { authenticated: false, error: 'Admin access required' };
      }

      return { authenticated: true, user, role: profile.role };
    }

    return { authenticated: true, user };
  } catch (err: any) {
    return { authenticated: false, error: err.message || 'Auth verification failed' };
  }
}

async function loadProfileRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

/**
 * Verify admin auth for server actions.
 * Requires passing the auth token from the client.
 */
export async function verifyAdminToken(token: string): Promise<AuthResult> {
  if (!token) {
    return { authenticated: false, error: 'Missing token' };
  }

  try {
    if (isPlainPostgres()) {
      const auth = await import('./db/auth');
      const verified = await auth.verifyAccessToken(token);
      if (!verified) {
        return { authenticated: false, error: 'Invalid or expired token' };
      }
      const user = await auth.getUserById(verified.userId);
      if (!user) {
        return { authenticated: false, error: 'Invalid or expired token' };
      }
      const role =
        (user.app_metadata?.role as string | undefined) ||
        (await loadProfileRole(user.id));
      if (role !== 'admin' && role !== 'staff') {
        return { authenticated: false, error: 'Admin access required' };
      }
      return { authenticated: true, user, role: role || undefined };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { authenticated: false, error: 'Could not verify role' };
    }

    if (profile.role !== 'admin' && profile.role !== 'staff') {
      return { authenticated: false, error: 'Admin access required' };
    }

    return { authenticated: true, user, role: profile.role };
  } catch (err: any) {
    return { authenticated: false, error: err.message || 'Auth failed' };
  }
}
