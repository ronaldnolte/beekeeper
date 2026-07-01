import { applyCors, escapeHtml, getAuthedUser, getResendKey } from './_lib.js';

// Vercel Serverless Function signature:
export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, email, sessionToken } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Feedback comes from inside the signed-in app only — reject anonymous
    // callers so this can't be used as an open email relay.
    const auth = await getAuthedUser(sessionToken);
    if (!auth) {
      res.status(401).json({ error: 'You must be signed in to send feedback.' });
      return;
    }

    const apiKey = getResendKey();
    if (!apiKey) {
      console.error('Missing RESEND_API_KEY');
      res.status(500).json({ error: 'Feedback service unavailable (configuration error).' });
      return;
    }

    const safeMessage = escapeHtml(message);
    const safeEmail = email ? escapeHtml(email) : null;

    console.log('Sending feedback email via Resend API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <beta@beektools.com>',
        to: 'ron.nolte@gmail.com', // Always route to Ron
        replyTo: email || undefined, // Direct reply to the user if email is provided
        subject: '🐝 App Feedback: Beekeeper',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New Feedback Received</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a; white-space: pre-wrap;">${safeMessage}</p>
            </div>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Sender's Email:</strong> ${safeEmail ? `<a href="mailto:${safeEmail}" style="color:#F5A623; font-weight:bold;">${safeEmail}</a>` : '<em>Not provided</em>'}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Account:</strong> ${escapeHtml(auth.user.email || auth.user.id)}</p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by Beekeeper App</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Resend API Error:', data);
      res.status(502).json({ error: 'Failed to send feedback email. Please try again later.' });
      return;
    }

    console.log('Email sent successfully via Resend!');
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Serverless Function Error:', error.message || error);
    res.status(500).json({ error: 'Failed to send feedback email. Please try again later.' });
  }
}
