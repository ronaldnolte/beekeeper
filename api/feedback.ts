import nodemailer from 'nodemailer';

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

    // Gmail connection details with reliable fallback credentials
    const user = process.env.GMAIL_USER || 'ron.nolte@gmail.com';
    const pass = process.env.GMAIL_APP_PASSWORD || 'oelq wtqr npmb glfg';

    // Create SMTP transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `Beekeeper App <${user}>`,
      to: 'ron.nolte@gmail.com', // Always route to Ron
      replyTo: email || user,   // Direct reply to the user if email is provided
      subject: '🐝 App Feedback: Beekeeper',
      text: `New feedback received:\n\n${message}\n\n---\nSent from Beekeeper App\nReply-to: ${email || 'Not provided'}`,
    };

    console.log('Sending email via Gmail SMTP...');
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Nodemailer Error:', error.message || error);
    res.status(500).json({ 
      error: 'Failed to send feedback email', 
      details: error.message || error 
    });
  }
}
