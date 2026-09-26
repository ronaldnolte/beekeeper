// Signed-in check for server functions — SPEC D §1. The returned client carries the caller's
// token, so the database's row rules apply to every query made with it.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { checkDatabase } from '../config/database-guard.js';

function config() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase configuration is missing.');
  // Same guard as the build: a non-main deployment must never reach production (CONSTRAINTS §4).
  const problem = checkDatabase({
    supabaseUrl: url,
    onVercel: process.env.VERCEL === '1',
    branch: process.env.VERCEL_GIT_COMMIT_REF,
  });
  if (problem) throw new Error(`[database guard] ${problem}`);
  return { url, key };
}

export interface SignedIn {
  user: User;
  client: SupabaseClient;
}

/** Null when there is no token or it is expired or forged. Throws on missing configuration. */
export async function getSignedInUser(token: string | null | undefined): Promise<SignedIn | null> {
  const { url, key } = config();
  if (!token) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, client };
}
