// Installed phone builds are frozen code (CONSTRAINTS §1): every /api endpoint must keep
// answering the Android WebView origin (https://localhost) and today's request shapes —
// token in the body for chat/transcribe/feedback, Bearer header for nectar/geocode.
import { describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const seen: (string | null)[] = [];
vi.mock('../api/_supabase.js', () => ({
  getSignedInUser: async (token: string | null) => (seen.push(token), null),
}));

const endpoints = {
  chat: (await import('../api/chat.js')).default,
  transcribe: (await import('../api/transcribe.js')).default,
  geocode: (await import('../api/geocode.js')).default,
  feedback: (await import('../api/feedback.js')).default,
  beta: (await import('../api/beta.js')).default,
  'notify-signup': (await import('../api/notify-signup.js')).default,
};

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

async function call(handler: Handler, req: { method: string; headers?: Record<string, string>; body?: unknown; query?: Record<string, string> }) {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    status: (c: number) => ((out.status = c), res),
    json: (b: unknown) => ((out.body = b), res),
    send: (b: unknown) => ((out.body = b), res),
    end: () => res,
    setHeader: (k: string, v: string) => ((out.headers[k.toLowerCase()] = v), res),
  };
  await handler({ headers: {}, query: {}, ...req } as unknown as VercelRequest, res as unknown as VercelResponse);
  return out;
}

describe('old phone builds (Android WebView origin)', () => {
  for (const [name, handler] of Object.entries(endpoints)) {
    it(`${name}: preflight from https://localhost is allowed`, async () => {
      const r = await call(handler as Handler, { method: 'OPTIONS', headers: { origin: 'https://localhost' } });
      expect(r.status).toBe(204);
      expect(r.headers['access-control-allow-origin']).toBe('https://localhost');
      expect(r.headers['access-control-allow-headers']).toContain('Authorization');
    });
  }

  it('an unknown origin gets no permission header', async () => {
    const r = await call(endpoints.chat as Handler, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('chat, transcribe and feedback read the token from the body', async () => {
    seen.length = 0;
    await call(endpoints.chat as Handler, { method: 'POST', headers: { origin: 'https://localhost' }, body: { question: 'q', apiaryId: 'a', sessionToken: 'body-token' } });
    await call(endpoints.transcribe as Handler, { method: 'POST', body: { attachmentId: 'a', audioBase64: 'x', sessionToken: 'body-token' } });
    await call(endpoints.feedback as Handler, { method: 'POST', body: { message: 'm', sessionToken: 'body-token' } });
    expect(seen).toEqual(['body-token', 'body-token', 'body-token']);
  });

  it('geocode reads the Bearer header', async () => {
    seen.length = 0;
    const r = await call(endpoints.geocode as Handler, { method: 'GET', headers: { authorization: 'bearer header-token' }, query: { q: 'Tijeras' } });
    expect(seen).toEqual(['header-token']);
    expect(r.status).toBe(401);
  });
});
