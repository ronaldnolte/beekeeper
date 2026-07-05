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

/**
 * Pull the session token out of an `Authorization: Bearer <token>` header.
 * Used by the GET endpoints (the POST ones carry the token in the body).
 */
export function getBearerToken(req: any): string | null {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** The real client IP from Vercel's forwarding headers (first hop wins). */
export function getClientIp(req: any): string {
  return String(req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown')
    .split(',')[0]
    .trim();
}

/**
 * Simple in-memory sliding-window rate limiter. State lives only in this
 * serverless instance — it resets on a cold start and isn't shared across
 * parallel instances, so it blunts burst scripts rather than enforcing a hard
 * global cap. Deliberate trade-off to avoid a database round-trip. Returns a
 * function that records a hit for `key` and reports whether it's now limited.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => t > now - opts.windowMs);
    if (recent.length >= opts.max) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    // Bound memory if someone rotates through many keys.
    if (hits.size > 5000) {
      for (const k of hits.keys()) {
        if (hits.size <= 2500) break;
        hits.delete(k);
      }
    }
    return false;
  };
}

/**
 * Temporary grace window for the nectar endpoints' new sign-in requirement.
 * While active, anonymous (un-authenticated) requests are let through so
 * already-installed app builds that don't yet send a session token keep
 * working. Controlled by the NECTAR_AUTH_GRACE_UNTIL env var (an ISO date or
 * datetime); unset, unparseable, or past ⇒ inactive ⇒ auth strictly required.
 * Remove this and its callers once old builds have aged out.
 */
export function isNectarAuthGraceActive(): boolean {
  const until = process.env.NECTAR_AUTH_GRACE_UNTIL;
  if (!until) return false;
  const deadline = Date.parse(until);
  if (isNaN(deadline)) return false;
  return Date.now() < deadline;
}

// Shown when the nectar auth grace has ended and a caller still has no valid
// session — almost always an old app build that never sent a token. Kept as
// plain text (not JSON) because the installed Nectar view renders the raw
// response body as its on-screen error, so this reads as a clean instruction.
export const NECTAR_UPDATE_REQUIRED_MSG =
  'Please update Beekeeper to the latest version (open Google Play and update) to keep using Nectar Flow.';

/** Send the "update required" instruction as plain text (see the note above). */
export function sendUpdateRequired(res: any): void {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(401).end(NECTAR_UPDATE_REQUIRED_MSG);
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

/**
 * Try each URL in order with a per-attempt timeout; return the first OK
 * response (and which URL won), or null if every candidate failed. Built for
 * third-party failover — e.g. Open-Meteo's forecast host going down while its
 * separately-hosted auxiliary (historical-forecast) API stays up, which is
 * exactly what happened in the 2026-07-03 outage.
 */
export async function fetchFirstOk(
  urls: string[],
  timeoutMs = 8000
): Promise<{ res: Response; url: string } | null> {
  for (const url of urls) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.ok) return { res, url };
      console.warn(`fetchFirstOk: ${res.status} from ${url.split('?')[0]} — trying next`);
    } catch (e: any) {
      console.warn(`fetchFirstOk: ${e?.name || 'error'} from ${url.split('?')[0]} — trying next`);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
