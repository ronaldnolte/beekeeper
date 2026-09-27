// POST /api/beta (public) — SPEC D §7. Same answer whether or not the address was already
// registered, so it never reveals who signed up (SCAR S-API-9).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { clientIp, createRateLimiter, escapeHtml, handleCors, methodNotAllowed } from './_http.js';
import { RON, betaNotificationEmail, betaWelcomeEmail, sendEmail } from './_emails.js';
import { checkDatabase } from '../config/database-guard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const allow = createRateLimiter(3, 10 * 60 * 1000);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = (typeof req.body === 'object' && req.body) || {};
    const { email, website } = body as { email?: unknown; website?: unknown };

    // 1. Honeypot: pretend success, do nothing.
    if (typeof website === 'string' && website.trim() !== '') return res.status(200).json({ success: true });

    // 2. Rate limit per IP.
    if (!allow(clientIp(req))) {
      return res.status(429).json({ error: 'Too many signup attempts. Please wait a few minutes and try again.' });
    }

    // 3. Validate.
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.trim().length > 254) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // 4. Configuration.
    const clean = email.trim().toLowerCase();
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'Signup service unavailable (configuration error).' });
    }
    const problem = checkDatabase({ supabaseUrl: url, onVercel: process.env.VERCEL === '1', branch: process.env.VERCEL_GIT_COMMIT_REF });
    if (problem) throw new Error(`[database guard] ${problem}`);

    // 5. Record it (anonymous client); failures here do not stop the flow.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    let alreadyExists = false;
    let dbSuccess = false;
    let dbError = '';
    try {
      const { data: existing, error: findErr } = await db.from('beta_signups').select('id').eq('email', clean).maybeSingle();
      if (findErr) throw findErr;
      alreadyExists = !!existing;
      if (!alreadyExists) {
        const { error: insErr } = await db.from('beta_signups').insert({ email: clean, created_at: new Date().toISOString() });
        if (insErr) throw insErr;
      }
      dbSuccess = true;
    } catch (err) {
      dbError = (err as { message?: string }).message ?? String(err);
      console.error('[beta] database', dbError);
    }

    // 6. Two emails in parallel; Resend errors are logged only.
    const safeEmail = escapeHtml(clean);
    const note = betaNotificationEmail(safeEmail, alreadyExists, dbSuccess, escapeHtml(dbError));
    const welcome = betaWelcomeEmail(safeEmail);
    const results = await Promise.all([sendEmail({ to: RON, ...note }), sendEmail({ to: clean, ...welcome })]);
    results.forEach(r => r.ok || console.error('[beta] email', r.error));

    // 7. Always the same answer.
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[beta]', err);
    return res.status(500).json({ error: 'Failed to process beta signup. Please try again later.' });
  }
}
