// POST /api/chat — Ask AI (SPEC D §3). Token in the body: installed phone builds send exactly
// this shape. Each question is answered alone (no memory). Prompt verbatim: APPENDIX-C C1.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, methodNotAllowed } from './_http.js';
import { getSignedInUser } from './_supabase.js';
import { generate, isRateLimit } from './_gemini.js';

/** Season from the server clock (UTC month); southern hemisphere swaps. */
export function estimateSeason(lat: number, month0: number): string {
  const north = month0 >= 2 && month0 <= 4 ? 'Spring' : month0 >= 5 && month0 <= 7 ? 'Summer' : month0 >= 8 && month0 <= 10 ? 'Autumn' : 'Winter';
  if (lat > 0) return north;
  return { Spring: 'Autumn', Autumn: 'Spring', Summer: 'Winter', Winter: 'Summer' }[north]!;
}

export function buildPrompt(weatherContext: string, uniqueHiveTypes: string[]): string {
  return `You are an expert beekeeping assistant for the 'BeekTools' application.
Goal: Answer the user's beekeeping question concisely and accurately.

CONTEXT:
${weatherContext}
User's Hive Types in this Apiary: ${uniqueHiveTypes.join(', ') || 'None specified'}.

RULES:
1. If the question is NOT related to beekeeping, bees, hives, or apiary management, politely decline to answer.
2. Context Awareness: Use the location/season context to tailor your advice.
3. Hive Type Awareness: If the advice depends heavily on hive type (e.g. "adding a super") and the user has multiple incompatible types (e.g. Top Bar vs Langstroth) and didn't specify which one, ask for clarification.
4. Formatting: Use Markdown (bolding, lists) for readability. Keep it under 200 words if possible.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const { question, apiaryId, sessionToken } = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
    if (!question || !apiaryId) return res.status(400).json({ error: 'Missing question or apiaryId' });

    const auth = await getSignedInUser(typeof sessionToken === 'string' ? sessionToken : null);
    if (!auth) return res.status(401).json({ error: 'You must be signed in to use the AI assistant.' });
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return res.status(500).json({ error: 'AI Service is currently unavailable (Configuration Error).' });
    }

    // Context, read as the user (row rules apply).
    const { data: apiary, error: apiaryErr } = await auth.client
      .from('apiaries')
      .select('zip_code, latitude, longitude')
      .eq('id', String(apiaryId))
      .maybeSingle();
    if (apiaryErr || !apiary) return res.status(500).json({ error: 'Could not fetch Apiary location context.' });

    const { data: hives } = await auth.client.from('hives').select('type').eq('apiary_id', String(apiaryId));
    const uniqueHiveTypes = [...new Set((hives ?? []).map((h: { type: string | null }) => h.type).filter((t): t is string => !!t))];

    // Season only when both coordinates are present (a zip-only apiary gets none — existing behaviour).
    const weatherContext =
      apiary.latitude && apiary.longitude
        ? `Location: ${apiary.zip_code || 'Lat/Lng provided'}. Estimated Season: ${estimateSeason(apiary.latitude, new Date().getUTCMonth())}.`
        : 'Location coordinates: N/A';

    try {
      const answer = await generate([{ text: buildPrompt(weatherContext, uniqueHiveTypes) }, { text: `Question: ${String(question)}` }]);
      return res.status(200).json({ answer });
    } catch (err) {
      console.error('[chat] model', err);
      if (isRateLimit(err)) return res.status(429).json({ error: 'The hive is busy (Rate Limit Reached). Please try again in a minute.' });
      return res.status(500).json({ error: 'Failed to process request. Please try again.' });
    }
  } catch (err) {
    console.error('[chat]', err);
    return res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
}
