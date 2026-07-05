import { createClient } from '@supabase/supabase-js';
import { applyCors, escapeHtml, getResendKey, createRateLimiter, getClientIp } from './_lib.js';

// Public closed-beta signup. Deliberately unauthenticated (it's the signup
// form), so it must never reveal whether an address is already registered and
// must never run with baked-in credentials.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Every accepted request sends two real emails, so a burst is the abuse to
// stop: at most 3 submissions per 10 minutes per IP (best-effort, in-memory).
const betaLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 3 });

// Vercel Serverless Function signature:
export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, website } = req.body;

    // Honeypot: `website` is a hidden field real users never see. Bots that
    // auto-fill every field give themselves away — claim success, do nothing.
    if (typeof website === 'string' && website.trim() !== '') {
      res.status(200).json({ success: true });
      return;
    }

    if (betaLimiter(getClientIp(req))) {
      res.status(429).json({ error: 'Too many signup attempts. Please wait a few minutes and try again.' });
      return;
    }

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const safeEmail = escapeHtml(cleanEmail);

    // Connect to Supabase — configuration comes from the environment only.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const apiKey = getResendKey();
    if (!supabaseUrl || !supabaseAnonKey || !apiKey) {
      console.error('Beta signup: missing Supabase or Resend configuration');
      res.status(500).json({ error: 'Signup service unavailable (configuration error).' });
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let dbSuccess = false;
    let dbErrorDetails = null;
    let alreadyExists = false;

    try {
      // 1. Check duplicate
      const { data: existing } = await supabase
        .from('beta_signups')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        console.log(`User ${cleanEmail} already exists. Continuing to send verification emails...`);
        dbSuccess = true;
        alreadyExists = true;
      } else {
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
      }
    } catch (dbErr: any) {
      dbErrorDetails = dbErr.message || dbErr;
      console.error('Database connection error during beta signup:', dbErr);
    }

    // 3. Trigger Resend Emails (1 to Ron as notification, 1 to Tester as welcome)
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
              <p style="margin: 12px 0 4px 0; font-size: 14px;"><strong>Tester Email:</strong> <a href="mailto:${safeEmail}" style="color:#F5A623; font-weight:bold; text-decoration:none;">${safeEmail}</a></p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Registration Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} (MST)</p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Already Registered:</strong> ${alreadyExists ? 'Yes' : 'No'}</p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Saved in Database:</strong> ${dbSuccess ? '✅ Yes' : `❌ No (Details: ${escapeHtml(dbErrorDetails || 'Unknown')})`}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: #333; font-weight: bold; background: #fffcf4; border: 1px dashed #F5A623; padding: 12px; border-radius: 8px;">
              👉 Action required: Copy the email address above and paste it into your Google Play Console's Beta Testers email list to grant them access!
            </p>
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
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">We've received your request!</p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #444;">We are currently adding your Gmail address to our approved tester list. Once authorized (usually within 24 hours), you will be able to download the app directly on Google Play using the link below:</p>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="https://play.google.com/apps/testing/com.beektools.beekeeper" style="background-color: #F5A623; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 15px;">📱 Access Beekeeper Beta on Google Play</a>
            </div>

            <p style="margin: 0; font-size: 12px; color: #666; background: #f9f9f9; padding: 10px; border-radius: 8px; border-left: 3px solid #F5A623;">
              <strong>Note:</strong> Make sure you are signed into Google Play with the same email address (${safeEmail}) that you registered with.
            </p>

            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Best regards,<br/>The BeekTools Team</p>
          </div>
        `,
      }),
    });

    // Run both email requests concurrently
    const [ronRes, testerRes] = await Promise.all([ronEmailPromise, testerEmailPromise]);

    if (!ronRes.ok) {
      console.warn('Resend Notification API Error:', await ronRes.json().catch(() => ({})));
    }
    if (!testerRes.ok) {
      console.warn('Resend Welcome Email API Error:', await testerRes.json().catch(() => ({})));
    }

    console.log(`Beta signup process completed successfully for: ${cleanEmail}!`);
    // Same response whether or not the address was already registered — a
    // public endpoint must not let outsiders probe who has signed up.
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Beta Webhook Serverless Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process beta signup. Please try again later.' });
  }
}
