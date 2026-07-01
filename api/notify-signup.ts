import { applyCors, escapeHtml, getResendKey } from './_lib.js';

// Called by a Supabase trigger when a new user registers. This endpoint fails
// closed: if WEBHOOK_SECRET is not configured, it refuses every request rather
// than running wide open.

// Vercel Serverless Function signature:
export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Webhook secret is REQUIRED — the Supabase trigger must send it.
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET is not configured; rejecting webhook call.');
      res.status(500).json({ error: 'Webhook not configured.' });
      return;
    }
    if (req.headers.authorization !== `Bearer ${webhookSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Payload body is required' });
      return;
    }

    // Extract newly registered user email and created time from Supabase trigger payload
    const record = payload.record || payload;
    const userEmail = escapeHtml(record.email || 'Unknown email');
    const createdAt = record.created_at || new Date().toISOString();

    const apiKey = getResendKey();
    if (!apiKey) {
      console.error('Missing RESEND_API_KEY');
      res.status(500).json({ error: 'Notification service unavailable (configuration error).' });
      return;
    }

    console.log(`Sending signup notification for user: ${userEmail}...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <beta@beektools.com>',
        to: 'ron.nolte@gmail.com', // Always route to Ron
        subject: '🐝 New BeekTools User Signup',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New BeekTools Signup</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a;">A new beekeeper has registered a BeekTools account!</p>
              <p style="margin: 12px 0 4px 0; font-size: 14px;"><strong>Beekeeper Email:</strong> <a href="mailto:${userEmail}" style="color:#F5A623; font-weight:bold; text-decoration:none;">${userEmail}</a></p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Registration Time:</strong> ${new Date(createdAt).toLocaleString('en-US', { timeZone: 'America/Denver' })} (MST)</p>
            </div>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by BeekTools Webhook Trigger</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Resend Webhook API Error:', data);
      res.status(502).json({ error: 'Failed to send signup notification.' });
      return;
    }

    console.log(`Signup notification sent successfully for: ${userEmail}!`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Signup Webhook Serverless Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process signup webhook.' });
  }
}
