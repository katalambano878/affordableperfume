/**
 * Server-only data access (RSC, route handlers, notifications).
 * Uses in-process pg compat when DATABASE_URL is set; otherwise hosted Supabase.
 */
import { supabaseAdmin } from './supabase-admin';

export { supabaseAdmin as serverDb };
