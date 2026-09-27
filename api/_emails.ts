// Server emails via Resend — SPEC E §7, templates verbatim from APPENDIX-C. Every user value is
// HTML-escaped before it reaches a template (SCAR S-API-7).

const FROM = 'BeekTools <beta@beektools.com>';
export const RON = 'ron.nolte@gmail.com';

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(msg: { to: string; subject: string; html: string; replyTo?: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text().catch(() => '')}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const denver = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/Denver' });

/** C2 — safeMessage, safeEmail and account are already escaped. */
export function feedbackEmail(safeMessage: string, safeEmail: string | null, safeAccount: string) {
  return {
    subject: '🐝 App Feedback: Beekeeper',
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New Feedback Received</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a; white-space: pre-wrap;">${safeMessage}</p>
            </div>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Sender's Email:</strong> ${safeEmail ? `<a href="mailto:${safeEmail}" style="color:#F5A623; font-weight:bold;">${safeEmail}</a>` : '<em>Not provided</em>'}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Account:</strong> ${safeAccount}</p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by Beekeeper App</p>
          </div>
        `,
  };
}

/** C3 — notification to Ron. safeEmail and safeDbError are already escaped. */
export function betaNotificationEmail(safeEmail: string, alreadyExists: boolean, dbSuccess: boolean, safeDbError: string) {
  return {
    subject: '🐝 New Beta Tester Signup!',
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New Beta Request</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a;">A new beekeeper has requested beta access to the application!</p>
              <p style="margin: 12px 0 4px 0; font-size: 14px;"><strong>Tester Email:</strong> <a href="mailto:${safeEmail}" style="color:#F5A623; font-weight:bold; text-decoration:none;">${safeEmail}</a></p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Registration Time:</strong> ${denver(new Date())} (MST)</p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Already Registered:</strong> ${alreadyExists ? 'Yes' : 'No'}</p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Saved in Database:</strong> ${dbSuccess ? '✅ Yes' : `❌ No (Details: ${safeDbError || 'Unknown'})`}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: #333; font-weight: bold; background: #fffcf4; border: 1px dashed #F5A623; padding: 12px; border-radius: 8px;">
              👉 Action required: Copy the email address above and paste it into your Google Play Console's Beta Testers email list to grant them access!
            </p>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by BeekTools Beta Signup</p>
          </div>
        `,
  };
}

/** C4 — welcome to the tester. safeEmail is already escaped. */
export function betaWelcomeEmail(safeEmail: string) {
  return {
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
  };
}

/** C5 — new-account notification. userEmail is already escaped. */
export function signupNotificationEmail(userEmail: string, createdAt: string | number | Date) {
  return {
    subject: '🐝 New BeekTools User Signup',
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; line-height: 1.6; color: #333;">
            <h2 style="color: #F5A623; margin-top: 0; border-bottom: 2px solid #FFFBF0; padding-bottom: 10px; font-weight: 900; font-size: 20px; text-transform: uppercase; tracking-wide">🐝 New BeekTools Signup</h2>
            <div style="background: #FFFBF0; border: 1px solid #E6DCC3; border-radius: 12px; padding: 18px; margin: 18px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <p style="margin: 0; font-size: 15px; color: #1a1a1a;">A new beekeeper has registered a BeekTools account!</p>
              <p style="margin: 12px 0 4px 0; font-size: 14px;"><strong>Beekeeper Email:</strong> <a href="mailto:${userEmail}" style="color:#F5A623; font-weight:bold; text-decoration:none;">${userEmail}</a></p>
              <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Registration Time:</strong> ${denver(new Date(createdAt))} (MST)</p>
            </div>
            <p style="color: #aaa; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Sent automatically by BeekTools Webhook Trigger</p>
          </div>
        `,
  };
}
