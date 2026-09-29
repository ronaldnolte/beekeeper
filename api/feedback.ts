// POST /api/feedback — SPEC D §6, EMAILS §3. Token in the body (installed phone builds send this
// shape). The client inserts the app_feedback row itself before calling this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { escapeHtml, handleCors, methodNotAllowed } from './_http.js';
import { getSignedInUser } from './_supabase.js';
import { RON, feedbackEmail, sendEmail } from './_emails.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const { message, email, sessionToken } = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const auth = await getSignedInUser(typeof sessionToken === 'string' ? sessionToken : null);
    if (!auth) return res.status(401).json({ error: 'You must be signed in to send feedback.' });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Feedback service unavailable (configuration error).' });

    const replyTo = typeof email === 'string' && EMAIL_RE.test(email.trim()) ? email.trim() : undefined;
    const safeEmail = typeof email === 'string' && email.trim() ? escapeHtml(email.trim()) : null;
    const note = feedbackEmail(escapeHtml(message), safeEmail, escapeHtml(auth.user.email ?? auth.user.id));
    const sent = await sendEmail({ to: RON, ...note, replyTo });
    if (!sent.ok) {
      console.error('[feedback] email', sent.error);
      return res.status(502).json({ error: 'Failed to send feedback email. Please try again later.' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[feedback]', err);
    return res.status(500).json({ error: 'Failed to send feedback email. Please try again later.' });
  }
}
