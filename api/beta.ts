import { createClient } from '@supabase/supabase-js';

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
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ayeqrbcvihztxbrxmrth.supabase.co';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YeFrbZkCUwM-cSAm3ZODrg_ie0j1Maa';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let dbSuccess = false;
    let dbErrorDetails = null;

    try {
      // 1. Check duplicate
      const { data: existing } = await supabase
        .from('beta_signups')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        res.status(400).json({ error: 'This email is already on the list!' });
        return;
      }

      // 2. Insert record
      const { error: insertError } = await supabase
        .from('beta_signups')
        .insert([{ email: cleanEmail, created_at: new Date().toISOString() }]);

      if (insertError) {
        dbErrorDetails = insertError.message;
        console.warn('Database insert failed (possibly RLS restriction):', insertError);
      } else {
        dbSuccess = true;
      }
    } catch (dbErr: any) {
      dbErrorDetails = dbErr.message || dbErr;
      console.error('Database connection error during beta signup:', dbErr);
    }

    // 3. Trigger Resend Email Notification (always do this so Ron is notified)
    const apiKey = process.env.RESEND_API_KEY || 're_RRkAoNA9_KZQBPSR9MRexZ8T2EBNybUpA';

    console.log(`Sending beta waitlist alert for user: ${cleanEmail}...`);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <onboarding@resend.dev>',
        to: 'ron.nolte@gmail.com', // Always route to Ron
        subject: '🐝 New Beta Tester Signup!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New Beta Request</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a;">A new beekeeper has requested beta access to the application!</p>
              <p style="margin: 12px 0 4px 0; font-size: 14px;"><strong>Tester Email:</strong> <a href="mailto:${cleanEmail}" style="color:#F5A623; font-weight:bold; text-decoration:none;">${cleanEmail}</a></p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Registration Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} (MST)</p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Saved in Database:</strong> ${dbSuccess ? '✅ Yes' : `❌ No (Details: ${dbErrorDetails || 'Unknown'})`}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: #333;">Please add this email to your <a href="https://play.google.com/console" style="color:#F5A623; font-weight:bold; text-decoration:underline;">Google Play Console</a> Closed/Alpha testing testers list.</p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by BeekTools Beta Signup</p>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend Webhook API Error:', emailData);
      res.status(emailResponse.status).json({ error: 'Failed to send signup email via Resend', details: emailData });
      return;
    }

    console.log(`Beta request sent successfully for: ${cleanEmail}!`);
    res.status(200).json({ success: true, dbSuccess });
  } catch (error: any) {
    console.error('Beta Webhook Serverless Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process beta signup', details: error.message || error });
  }
}
