// POST /api/feedback (SPEC D §6) and POST /api/notify-signup (SPEC D §8), offline; plus the
// profile/roadmap helpers (SPEC C §5, §7).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../api/_supabase.js', () => ({
  getSignedInUser: async (token: string | null) => (token === 'good' ? { user: { id: 'u1', email: 'bee@example.com' }, client: {} } : null),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));

const sent: { body: Record<string, unknown> }[] = [];
let resendOk = true;
beforeEach(() => {
  sent.length = 0;
  resendOk = true;
  process.env.RESEND_API_KEY = 'test';
  process.env.WEBHOOK_SECRET = 's3cret';
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    sent.push({ body: JSON.parse(init.body) });
    return { ok: resendOk, status: resendOk ? 200 : 422, text: async () => 'bad' };
  });
});
afterEach(() => vi.unstubAllGlobals());

const feedback = (await import('../api/feedback.js')).default;
const notify = (await import('../api/notify-signup.js')).default;
const { clampInt, sortRoadmap } = await import('../src/lib/profileData');

async function call(handler: typeof feedback, body: unknown, headers: Record<string, string> = {}) {
  const out = { status: 0, body: undefined as unknown };
  const res = { status: (c: number) => ((out.status = c), res), json: (b: unknown) => ((out.body = b), res), setHeader: () => res, end: () => res };
  await handler({ method: 'POST', body, headers } as unknown as VercelRequest, res as unknown as VercelResponse);
  return out;
}

describe('POST /api/feedback', () => {
  it('checks message, sign-in and configuration in order', async () => {
    expect(await call(feedback, { message: ' ' })).toEqual({ status: 400, body: { error: 'Message is required' } });
    expect(await call(feedback, { message: 'hi', sessionToken: 'bad' })).toEqual({ status: 401, body: { error: 'You must be signed in to send feedback.' } });
    delete process.env.RESEND_API_KEY;
    expect(await call(feedback, { message: 'hi', sessionToken: 'good' })).toEqual({ status: 500, body: { error: 'Feedback service unavailable (configuration error).' } });
  });

  it('emails Ron with escaped values, reply-to the sender, account = signed-in email', async () => {
    const r = await call(feedback, { message: '<b>mites</b>', email: 'me@x.org', sessionToken: 'good' });
    expect(r).toEqual({ status: 200, body: { success: true } });
    const b = sent[0].body;
    expect(b.to).toEqual(['ron.nolte@gmail.com']);
    expect(b.subject).toBe('🐝 App Feedback: Beekeeper');
    expect(b.reply_to).toBe('me@x.org');
    expect(b.html).toContain('&lt;b&gt;mites&lt;/b&gt;');
    expect(b.html).toContain('<strong>Account:</strong> bee@example.com');
  });

  it('502 when Resend refuses', async () => {
    resendOk = false;
    expect(await call(feedback, { message: 'hi', sessionToken: 'good' })).toEqual({ status: 502, body: { error: 'Failed to send feedback email. Please try again later.' } });
  });
});

describe('POST /api/notify-signup', () => {
  it('fails closed without the secret, rejects a wrong header', async () => {
    delete process.env.WEBHOOK_SECRET;
    expect(await call(notify, {}, { authorization: 'Bearer x' })).toEqual({ status: 500, body: { error: 'Webhook not configured.' } });
    process.env.WEBHOOK_SECRET = 's3cret';
    expect(await call(notify, {}, { authorization: 'Bearer nope' })).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(sent).toHaveLength(0);
  });

  it('emails the new user (record or body), escaped', async () => {
    const r = await call(notify, { record: { email: 'a<b>@x.org', created_at: '2026-09-28T18:00:00Z' } }, { authorization: 'Bearer s3cret' });
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(sent[0].body.subject).toBe('🐝 New BeekTools User Signup');
    expect(sent[0].body.html).toContain('a&lt;b&gt;@x.org');
    await call(notify, { email: 'plain@x.org' }, { authorization: 'Bearer s3cret' });
    expect(sent[1].body.html).toContain('plain@x.org');
  });
});

describe('profile and roadmap helpers', () => {
  it('clamps whole numbers, blank → null', () => {
    expect(clampInt('', 0, 80)).toBeNull();
    expect(clampInt('95', 0, 80)).toBe(80);
    expect(clampInt('-3', 0, 80)).toBe(0);
    expect(clampInt('4.6', 1, 60)).toBe(5);
  });

  it('sorts by votes, then newest first', () => {
    const items = [
      { id: 'a', votes: 1, created_at: '2026-01-01' },
      { id: 'b', votes: 4, created_at: '2025-01-01' },
      { id: 'c', votes: 1, created_at: '2026-06-01' },
    ];
    expect(sortRoadmap(items).map(i => i.id)).toEqual(['b', 'c', 'a']);
  });
});
