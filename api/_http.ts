// Shared request/response behaviour for every endpoint — SPEC D §1.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIXED_ORIGINS = [
  'https://beekeeper.beektools.com',
  'https://localhost', // Android WebView
  'capacitor://localhost', // iOS WebView
  'http://localhost:5173', // local development
];

function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return [...FIXED_ORIGINS, ...extra];
}

/**
 * Applies CORS headers for an allowed Origin. Returns true when the request was an OPTIONS
 * preflight and has been answered (204, no body).
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && allowedOrigins().includes(origin)) {
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

/** `Authorization: Bearer <token>`, "Bearer" case-insensitive. */
export function bearerToken(req: VercelRequest): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string') return null;
  const m = /^bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  if (first) return first;
  const real = req.headers['x-real-ip'];
  return (Array.isArray(real) ? real[0] : real) || 'unknown';
}

export function methodNotAllowed(res: VercelResponse) {
  res.status(405).json({ error: 'Method not allowed' });
}

/** `& < > " '` → entities, for every user value placed in an email (SCAR S-API-7). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tries each URL in order with a per-attempt timeout; returns the first OK response and which
 * URL won. Never throws; null if all fail.
 */
export async function fetchFirstOk(
  urls: readonly string[],
  timeoutMs: number,
): Promise<{ response: Response; url: string; index: number } | null> {
  for (let index = 0; index < urls.length; index++) {
    const url = urls[index];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return { response, url, index };
      console.warn(`[fetchFirstOk] ${response.status} from ${new URL(url).host}`);
    } catch (err) {
      console.warn(`[fetchFirstOk] failed ${new URL(url).host}: ${(err as Error).message}`);
    }
  }
  return null;
}

/** In-memory sliding-window rate limiter, per server instance (deliberately cheap). */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.delete(key); // re-insert so Map order tracks recency
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const k of hits.keys()) {
        if (hits.size <= 2500) break;
        hits.delete(k);
      }
    }
    return true;
  };
}
