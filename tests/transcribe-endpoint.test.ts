// POST /api/transcribe (SPEC D §4) offline, plus the record-date rule (SPEC B §14).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const world = {
  removed: [] as string[],
  updates: [] as unknown[],
  updateError: null as null | { message: string },
  model: async (): Promise<string> => '  queen seen, capped brood  ',
  parts: [] as unknown[],
};

vi.mock('../api/_supabase.js', () => ({
  getSignedInUser: async (token: string | null) =>
    token === 'good'
      ? {
          user: { id: 'u1' },
          client: {
            storage: { from: () => ({ remove: async (p: string[]) => (world.removed.push(...p), { error: null }) }) },
            from: () => ({ update: (row: unknown) => ({ eq: async () => (world.updates.push(row), { error: world.updateError }) }) }),
          },
        }
      : null,
}));
vi.mock('../api/_gemini.js', async () => {
  const real = await vi.importActual<typeof import('../api/_gemini.js')>('../api/_gemini.js');
  return { ...real, generate: async (parts: unknown[]) => ((world.parts = parts), world.model()) };
});

process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test';
const { default: handler, INSTRUCTION } = await import('../api/transcribe.js');
const { noonLocalIso, utcDay } = await import('../src/lib/recordDates');

async function post(body: unknown) {
  const out = { status: 0, body: undefined as unknown };
  const res = { status: (c: number) => ((out.status = c), res), json: (b: unknown) => ((out.body = b), res), setHeader: () => res, end: () => res };
  await handler({ method: 'POST', body, headers: {} } as unknown as VercelRequest, res as unknown as VercelResponse);
  return out;
}

beforeEach(() => {
  world.removed = [];
  world.updates = [];
  world.updateError = null;
  world.model = async () => '  queen seen, capped brood  ';
});

describe('POST /api/transcribe', () => {
  it('checks input then sign-in', async () => {
    expect(await post({ attachmentId: 'a' })).toEqual({ status: 400, body: { error: 'Missing attachmentId or audio.' } });
    expect(await post({ attachmentId: 'a', audioBase64: 'x', sessionToken: 'bad' })).toEqual({ status: 401, body: { error: 'You must be signed in to transcribe voice notes.' } });
  });

  it('sends the audio with the verbatim instruction, deletes the audio, stores the trimmed text', async () => {
    const r = await post({ attachmentId: 'a1', audioBase64: 'QUJD', mimeType: 'audio/webm;codecs=opus', audioPath: 'u1/i1/x.webm', sessionToken: 'good' });
    expect(r).toEqual({ status: 200, body: { transcript: 'queen seen, capped brood' } });
    expect(world.parts).toEqual([{ inline_data: { mime_type: 'audio/webm', data: 'QUJD' } }, { text: INSTRUCTION }]);
    expect(world.removed).toEqual(['u1/i1/x.webm']);
    expect(world.updates).toEqual([{ transcript: 'queen seen, capped brood', transcript_status: 'done', audio_path: null }]);
  });

  it('maps failures to the fixed messages', async () => {
    world.updateError = { message: 'rls' };
    expect(await post({ attachmentId: 'a', audioBase64: 'x', sessionToken: 'good' })).toEqual({ status: 500, body: { error: 'Transcribed, but could not store the transcript.' } });
    world.model = async () => {
      throw new Error('Gemini 429: slow down');
    };
    expect(await post({ attachmentId: 'a', audioBase64: 'x', sessionToken: 'good' })).toEqual({ status: 429, body: { error: 'Busy (rate limit). Try again shortly.' } });
  });
});

describe('record dates (SPEC B §14)', () => {
  it('shows the UTC calendar day and saves noon local time', () => {
    expect(utcDay('2026-06-05T23:30:00Z')).toBe('2026-06-05');
    expect(new Date(noonLocalIso('2026-06-05')).getHours()).toBe(12);
  });
});
