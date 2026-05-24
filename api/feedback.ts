// Vercel Serverless Function signature:
export default async function handler(req: any, res: any) {
  // 1. CORS headers (in case of local testing / cross-origin)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, email } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Securely pull the Resend API Key, falling back to your verified active project key
    const apiKey = process.env.RESEND_API_KEY || 're_RRkAoNA9_KZQBPSR9MRexZ8T2EBNybUpA';

    console.log('Sending feedback email via Resend API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <onboarding@resend.dev>',
        to: 'ron.nolte@gmail.com', // Always route to Ron
        replyTo: email || undefined, // Direct reply to the user if email is provided
        subject: '🐝 App Feedback: Beekeeper',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New Feedback Received</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Sender's Email:</strong> ${email ? `<a href="mailto:${email}" style="color:#F5A623; font-weight:bold;">${email}</a>` : '<em>Not provided</em>'}</p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by Beekeeper App</p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API Error:', data);
      res.status(response.status).json({ error: 'Failed to send email via Resend', details: data });
      return;
    }

    console.log('Email sent successfully via Resend!');
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Serverless Function Error:', error.message || error);
    res.status(500).json({ error: 'Failed to send feedback email', details: error.message || error });
  }
}
