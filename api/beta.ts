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
        console.log(`User ${cleanEmail} already exists. Succeeding silently to trigger redirect...`);
        res.status(200).json({ success: true, dbSuccess: true, alreadyExists: true });
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

    // 3. Trigger Resend Emails (1 to Ron as notification, 1 to Tester as welcome)
    const apiKey = process.env.RESEND_API_KEY || 're_RRkAoNA9_KZQBPSR9MRexZ8T2EBNybUpA';

    console.log(`Sending beta emails for: ${cleanEmail}...`);

    // Fetch call 1: Notification to Ron
    const ronEmailPromise = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <beta@beektools.com>',
        to: 'ron.nolte@gmail.com',
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
            <p style="margin: 0; font-size: 14px; color: #333;">The user has been automatically sent instructions to join your Google Group <strong>beekeeper-beta@googlegroups.com</strong> and download the app. No manual action is required!</p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by BeekTools Beta Signup</p>
          </div>
        `,
      }),
    });

    // Fetch call 2: Welcome to Tester
    const testerEmailPromise = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'BeekTools <beta@beektools.com>',
        to: cleanEmail,
        subject: '🐝 Welcome to the Beekeeper Beta!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 Welcome to the Beekeeper Beta!</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">You are ready to get started!</p>
              <p style="margin: 0; font-size: 14px; color: #444;">Please follow these <strong>2 quick steps</strong> to authorize your device and download the Beekeeper application:</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #1a1a1a; font-size: 15px; margin-bottom: 8px;">👉 Step 1: Join the Google Group</h3>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #555;">Click below and select <strong>"Join Group"</strong>. This instantly authorizes your Gmail address as an approved beta tester.</p>
              <div style="text-align: center; margin: 16px 0;">
                <a href="https://groups.google.com/g/beekeeper-beta/about" style="background-color: #F5A623; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 14px;">👥 1. Join the Google Group</a>
              </div>
            </div>

            <div style="margin: 20px 0; border-top: 1px solid #eee; padding-top: 20px;">
              <h3 style="color: #1a1a1a; font-size: 15px; margin-bottom: 8px;">👉 Step 2: Download the App</h3>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #555;">Once you've joined the group, click below to opt-in and download the app directly on Google Play:</p>
              <div style="text-align: center; margin: 16px 0;">
                <a href="https://play.google.com/apps/testing/com.beektools.beekeeper" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 14px;">📱 2. Download on Google Play</a>
              </div>
            </div>
            
            <p style="margin: 20px 0 0 0; font-size: 12px; color: #666; background: #f9f9f9; padding: 10px; border-radius: 8px; border-left: 3px solid #F5A623;">
              <strong>Note:</strong> If Google Play says "App not available", please ensure you are logged in to the Play Store with the exact same Gmail address you used to join the Google Group.
            </p>
            
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Best regards,<br/>The BeekTools Team</p>
          </div>
        `,
      }),
    });

    // Run both email requests concurrently
    const [ronRes, testerRes] = await Promise.all([ronEmailPromise, testerEmailPromise]);

    const ronEmailData = await ronRes.json();
    const testerEmailData = await testerRes.json();

    if (!ronRes.ok) {
      console.warn('Resend Notification API Error:', ronEmailData);
    }
    if (!testerRes.ok) {
      console.warn('Resend Welcome Email API Error:', testerEmailData);
    }

    console.log(`Beta signup process completed successfully for: ${cleanEmail}!`);
    res.status(200).json({ success: true, dbSuccess });
  } catch (error: any) {
    console.error('Beta Webhook Serverless Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process beta signup', details: error.message || error });
  }
}
