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
    // 2. Optional: Webhook Secret signature authorization
    const authHeader = req.headers.authorization;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
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
    const userEmail = record.email || 'Unknown email';
    const createdAt = record.created_at || new Date().toISOString();

    // Pull the active Resend API Key
    const apiKey = process.env.RESEND_API_KEY || 're_RRkAoNA9_KZQBPSR9MRexZ8T2EBNybUpA';

    console.log(`Sending signup notification for user: ${userEmail}...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <onboarding@resend.dev>',
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

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend Webhook API Error:', data);
      res.status(response.status).json({ error: 'Failed to send signup email via Resend', details: data });
      return;
    }

    console.log(`Signup notification sent successfully for: ${userEmail}!`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Signup Webhook Serverless Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process signup webhook', details: error.message || error });
  }
}
