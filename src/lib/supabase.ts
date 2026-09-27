import { createClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';

// CONSTRAINTS §7: the storage key is fixed — changing it signs every user out.
export const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'tbh_v2_session',
    flowType: 'pkce', // no tokens in URLs (SCAR S-AUTH-5)
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // recovery links (SCAR S-AUTH-3)
  },
});

export type Apiary = Tables<'apiaries'>;
export type Hive = Tables<'hives'>;
