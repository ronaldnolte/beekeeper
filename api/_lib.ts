import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Shared helpers for the Vercel serverless functions. The leading underscore
// keeps Vercel from exposing this file as an endpoint of its own.

// Origins allowed to call these functions from a browser. Same-origin calls
// (prod web + preview web use relative /api paths) send no Origin header and
// need no CORS. The packaged Capacitor app loads from localhost schemes, so
// those must be allowed explicitly. Extra origins can be added without a code
// change via the ALLOWED_ORIGINS env var (comma-separated).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://beekeeper.beektools.com',
  'https://localhost',      // Capacitor Android WebView
  'capacitor://localhost',  // Capacitor iOS WebView
  'http://localhost:5173',  // Vite dev server
];

/**
 * Apply origin-restricted CORS headers and answer preflight requests.
 * Returns true when the request was an OPTIONS preflight and has already been
 * answered — the caller should return immediately.
 */
export function applyCors(req: any, res: any): boolean {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [...DEFAULT_ALLOWED_ORIGINS, ...extra];

  const origin = req.headers?.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Verify a Supabase session token. Returns the authenticated user plus a
 * user-scoped client (RLS applies to every query it makes), or null when the
 * token is missing, expired, or forged.
 */
export async function getAuthedUser(
  sessionToken: string | undefined | null
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  if (!sessionToken) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${sessionToken}` } },
  });

  const { data, error } = await supabase.auth.getUser(sessionToken);
  if (error || !data?.user) return null;
  return { user: data.user, supabase };
}

/** Escape a string for safe interpolation into email/notification HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The Resend key comes from the environment only — never hardcoded. */
export function getResendKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}
