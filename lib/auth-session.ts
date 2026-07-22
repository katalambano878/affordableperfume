/** Clear supabase-js auth tokens from browser storage (all sb-* keys). */
export function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('sb-')) localStorage.removeItem(key);
  }
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('sb-')) sessionStorage.removeItem(key);
  }
}

/** Hard navigation after auth state change so session is picked up reliably. */
export function redirectAfterAuth(path: string) {
  if (typeof window === 'undefined') return;
  window.location.href = path;
}
