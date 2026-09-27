// POST /api/beta (SPEC D §7) offline: the database client and Resend are replaced.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const db = { existing: false, inserted: [] as unknown[] };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.existing ? { id: 'x' } : null, error: null }) }) }),
      insert: async (row: unknown) => {
        db.inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

const sent: { to: string[]; subject: string; html: string }[] = [];
vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
  sent.push(JSON.parse(init.body));
  return new Response('{}', { status: 200 });
});

process.env.VITE_SUPABASE_URL = 'https://byqznixioptovxvvonww.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';
process.env.RESEND_API_KEY = 'test';

const { default: handler } = await import('../api/beta.js');

let ipCounter = 0;
async function post(body: unknown) {
  const out = { status: 0, body: undefined as unknown };
  const res = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    setHeader: () => res,
    end: () => res,
  };
  const req = { method: 'POST', body, headers: { 'x-forwarded-for': `10.0.0.${++ipCounter}` } };
  await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  return out;
}

beforeEach(() => {
  sent.length = 0;
  db.inserted.length = 0;
  db.existing = false;
});

describe('POST /api/beta', () => {
  it('honeypot: pretends success and does nothing', async () => {
    expect(await post({ email: 'a@b.co', website: 'x' })).toEqual({ status: 200, body: { success: true } });
    expect(sent).toHaveLength(0);
    expect(db.inserted).toHaveLength(0);
  });

  it('rejects an invalid address', async () => {
    expect(await post({ email: 'nope', website: '' })).toEqual({ status: 400, body: { error: 'Valid email address is required' } });
  });

  it('records a new address, emails Ron and the tester, and escapes the address', async () => {
    const r = await post({ email: '  New<b>@Example.COM ', website: '' });
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(db.inserted).toHaveLength(1);
    expect((db.inserted[0] as { email: string }).email).toBe('new<b>@example.com');
    expect(sent.map(m => m.subject).sort()).toEqual(['🐝 New Beta Tester Signup!', '🐝 Welcome to the Beekeeper Beta!']);
    expect(sent.find(m => m.to[0] === 'ron.nolte@gmail.com')!.html).toContain('new&lt;b&gt;@example.com');
    expect(sent.every(m => !m.html.includes('<b>@'))).toBe(true);
  });

  it('gives the identical answer for an address already registered', async () => {
    db.existing = true;
    expect(await post({ email: 'old@example.com', website: '' })).toEqual({ status: 200, body: { success: true } });
    expect(db.inserted).toHaveLength(0);
    expect(sent.find(m => m.to[0] === 'ron.nolte@gmail.com')!.html).toContain('<strong>Already Registered:</strong> Yes');
  });

  it('allows three attempts per address in ten minutes, then refuses', async () => {
    const req = (ip: string) => ({ method: 'POST', body: { email: 'z@example.com', website: '' }, headers: { 'x-forwarded-for': ip } });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const out = { status: 0 };
      const res = { status: (c: number) => ((out.status = c), res), json: () => res, setHeader: () => res, end: () => res };
      await handler(req('192.168.1.1') as unknown as VercelRequest, res as unknown as VercelResponse);
      codes.push(out.status);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
  });
});
