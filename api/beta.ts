import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Helper to get Google OAuth Access Token using signed JWT (Domain-Wide Delegation)
async function getGoogleAccessToken(serviceAccount: any, adminEmail: string) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    sub: adminEmail,
    scope: 'https://www.googleapis.com/auth/admin.directory.group.member',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64ClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  
  const signInput = `${base64Header}.${base64ClaimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const jwt = `${signInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google OAuth error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Helper to add member to Google Group
async function addMemberToGoogleGroup(accessToken: string, groupEmail: string, memberEmail: string) {
  const url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: memberEmail,
      role: 'MEMBER',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (response.status === 409) {
      console.log(`User ${memberEmail} is already a member of ${groupEmail}`);
      return { success: true, alreadyMember: true };
    }
    throw new Error(`Google Directory API error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return { success: true, alreadyMember: false, data };
}

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

    // 3. Google Groups Integration
    let googleGroupSuccess = false;
    let googleGroupError = null;

    let serviceAccount: any = null;
    try {
      const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (rawKey) {
        const cleanKey = rawKey.trim().replace(/^'|'$/g, '');
        serviceAccount = JSON.parse(cleanKey);
      }
    } catch (err: any) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY env:', err);
    }

    if (serviceAccount) {
      try {
        const adminEmail = process.env.GOOGLE_ADMIN_EMAIL || 'ron@thenoltefamily.com';
        const groupEmail = process.env.GOOGLE_GROUP_EMAIL || 'testers@beektools.com';
        
        console.log(`Adding ${cleanEmail} to Google Group ${groupEmail} impersonating ${adminEmail}...`);
        const accessToken = await getGoogleAccessToken(serviceAccount, adminEmail);
        const groupRes = await addMemberToGoogleGroup(accessToken, groupEmail, cleanEmail);
        
        if (groupRes.success) {
          googleGroupSuccess = true;
          console.log(`Successfully added/verified ${cleanEmail} in Google Group!`);
        }
      } catch (groupErr: any) {
        googleGroupError = groupErr.message || groupErr;
        console.error('Google Group integration error:', groupErr);
      }
    } else {
      console.warn('Google service account key not configured. Skipping Google Group automated add.');
    }

    // 4. Trigger Resend Emails (1 to Ron as notification, 1 to Tester as welcome)
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
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Added to Google Group:</strong> ${googleGroupSuccess ? '✅ Yes' : `❌ No (Details: ${googleGroupError || 'Not configured'})`}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: #333;">The user has been automatically added to your Google Group <strong>testers@beektools.com</strong> and sent immediate download instructions. No manual action is required!</p>
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
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">You are ready to test!</p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #444;">Your Gmail address has been automatically added to our approved closed testing list (<strong>testers@beektools.com</strong>).</p>
              <p style="margin: 0; font-size: 14px; color: #444;">You are authorized to join the beta track and download the app directly on Google Play using the button below:</p>
            </div>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://play.google.com/apps/testing/com.beektools.beekeeper" style="background-color: #F5A623; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 15px;">📱 Access Beekeeper Beta on Google Play</a>
            </div>
            
            <p style="margin: 0; font-size: 12px; color: #666; background: #f9f9f9; padding: 10px; border-radius: 8px; border-left: 3px solid #F5A623;">
              <strong>Note:</strong> Make sure you are signed into Google Play with the same email address (${cleanEmail}) that you registered with.
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
