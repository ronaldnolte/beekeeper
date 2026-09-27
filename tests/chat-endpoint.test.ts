// POST /api/chat (SPEC D §3) offline: sign-in and the model are replaced.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const world = {
  apiary: { zip_code: '87105', latitude: 35.04, longitude: -106.7 } as Record<string, unknown> | null,
  hives: [{ type: 'Top Bar' }, { type: 'Langstroth' }, { type: 'Top Bar' }, { type: null }],
  model: async (_parts: unknown[]): Promise<string> => 'answer',
  lastParts: [] as { text: string }[],
};

vi.mock('../api/_supabase.js', () => ({
  getSignedInUser: async (token: string | null) =>
    token === 'good'
      ? {
          user: { id: 'u1' },
          client: {
            from: (table: string) =>
              table === 'apiaries'
                ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: world.apiary, error: null }) }) }) }
                : { select: () => ({ eq: async () => ({ data: world.hives, error: null }) }) },
          },
        }
      : null,
}));
vi.mock('../api/_gemini.js', async () => {
  const real = await vi.importActual<typeof import('../api/_gemini.js')>('../api/_gemini.js');
  return {
    ...real,
    generate: async (parts: { text: string }[]) => {
      world.lastParts = parts;
      return world.model(parts);
    },
  };
});

process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test';
const { default: handler, estimateSeason, buildPrompt } = await import('../api/chat.js');

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
  await handler({ method: 'POST', body, headers: {} } as unknown as VercelRequest, res as unknown as VercelResponse);
  return out;
}

beforeEach(() => {
  world.apiary = { zip_code: '87105', latitude: 35.04, longitude: -106.7 };
  world.model = async () => 'answer';
});

describe('POST /api/chat', () => {
  it('seasons by UTC month, southern hemisphere swapped', () => {
    expect([0, 2, 5, 8, 11].map(m => estimateSeason(35, m))).toEqual(['Winter', 'Spring', 'Summer', 'Autumn', 'Winter']);
    expect([0, 2, 5, 8].map(m => estimateSeason(-33, m))).toEqual(['Summer', 'Autumn', 'Winter', 'Spring']);
  });

  it('builds the prompt verbatim from APPENDIX-C C1', () => {
    // Copied unchanged from APPENDIX-C C1.
    const template = readFileSync(join(__dirname, 'golden/prompts/ask-ai-system.txt'), 'utf8');
    const expected = template.replace('${weatherContext}', 'CTX').replace("${uniqueHiveTypes.join(', ') || 'None specified'}", 'Top Bar, Langstroth');
    expect(buildPrompt('CTX', ['Top Bar', 'Langstroth'])).toBe(expected);
    expect(buildPrompt('CTX', [])).toContain("User's Hive Types in this Apiary: None specified.");
  });

  it('checks input, then sign-in', async () => {
    expect(await post({ apiaryId: 'a' })).toEqual({ status: 400, body: { error: 'Missing question or apiaryId' } });
    expect(await post({ question: 'q', apiaryId: 'a', sessionToken: 'bad' })).toEqual({ status: 401, body: { error: 'You must be signed in to use the AI assistant.' } });
  });

  it('answers with season context and de-duplicated hive types', async () => {
    const r = await post({ question: 'Feed?', apiaryId: 'a', sessionToken: 'good' });
    expect(r).toEqual({ status: 200, body: { answer: 'answer' } });
    expect(world.lastParts[0].text).toContain('Location: 87105. Estimated Season:');
    expect(world.lastParts[0].text).toContain("User's Hive Types in this Apiary: Top Bar, Langstroth.");
    expect(world.lastParts[1].text).toBe('Question: Feed?');
  });

  it('gives no season for a zip-only apiary (existing behaviour)', async () => {
    world.apiary = { zip_code: '87105', latitude: null, longitude: null };
    await post({ question: 'q', apiaryId: 'a', sessionToken: 'good' });
    expect(world.lastParts[0].text).toContain('Location coordinates: N/A');
  });

  it('maps errors to the fixed messages', async () => {
    world.apiary = null;
    expect(await post({ question: 'q', apiaryId: 'a', sessionToken: 'good' })).toEqual({ status: 500, body: { error: 'Could not fetch Apiary location context.' } });
    world.apiary = { zip_code: '', latitude: 1, longitude: 1 };
    world.model = async () => {
      throw new Error('Gemini 429: quota');
    };
    expect(await post({ question: 'q', apiaryId: 'a', sessionToken: 'good' })).toEqual({ status: 429, body: { error: 'The hive is busy (Rate Limit Reached). Please try again in a minute.' } });
    world.model = async () => {
      throw new Error('boom');
    };
    expect(await post({ question: 'q', apiaryId: 'a', sessionToken: 'good' })).toEqual({ status: 500, body: { error: 'Failed to process request. Please try again.' } });
  });
});
