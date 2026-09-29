// POST /api/notify-signup — SPEC D §8, EMAILS §6. Called by a Supabase database webhook on new
// auth users, with "Authorization: Bearer {WEBHOOK_SECRET}". Fails closed without the secret
// (SCAR S-API-8).

import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { escapeHtml, handleCors, methodNotAllowed } from './_http.js';
import { RON, sendEmail, signupNotificationEmail } from './_emails.js';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: 'Webhook not configured.' });
    const header = String(req.headers.authorization ?? '');
    if (!sameSecret(header, `Bearer ${secret}`)) return res.status(401).json({ error: 'Unauthorized' });

    const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : null;
    if (!body) return res.status(400).json({ error: 'Payload body is required' });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Notification service unavailable (configuration error).' });

    const record = (body.record && typeof body.record === 'object' ? body.record : body) as { email?: unknown; created_at?: unknown };
    const email = typeof record.email === 'string' && record.email ? escapeHtml(record.email) : 'Unknown email';
    const created = typeof record.created_at === 'string' || typeof record.created_at === 'number' ? record.created_at : new Date();

    const sent = await sendEmail({ to: RON, ...signupNotificationEmail(email, created) });
    if (!sent.ok) {
      console.error('[notify-signup] email', sent.error);
      return res.status(502).json({ error: 'Failed to send signup notification.' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[notify-signup]', err);
    return res.status(500).json({ error: 'Failed to process signup webhook.' });
  }
}
