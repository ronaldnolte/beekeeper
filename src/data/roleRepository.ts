import { supabase } from './supabase';

/**
 * Fetches the role strings assigned to a user from the `user_roles` table.
 * Used for feature gating (e.g. the `tester` role unlocks in-development features).
 *
 * Fail-safe: on any error (including RLS blocking the read) it returns [] so the
 * user simply falls back to the released experience rather than seeing a crash.
 */
export async function fetchUserRoles(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.warn('fetchUserRoles: defaulting to no roles —', error.message);
    return [];
  }
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  console.log('[roles] userId:', userId, '→', roles);
  return roles;
}
