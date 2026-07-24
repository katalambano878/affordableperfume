import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseShimOrigin } from './site-url';

function resolveAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'local-anon-key';
}

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(resolveSupabaseShimOrigin(), resolveAnonKey());
  }
  return browserClient;
}

export const supabase = createBrowserSupabaseClient();
