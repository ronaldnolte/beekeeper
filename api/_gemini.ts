// Google Gemini (gemini-2.5-flash) over its REST API — used by chat and transcribe.

const MODEL = 'gemini-2.5-flash';

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** A rate-limit answer from the model (status 429, or a message mentioning 429). */
export const isRateLimit = (err: unknown) =>
  (err instanceof GeminiError && err.status === 429) || /429/.test((err as Error)?.message ?? '');

export async function generate(parts: GeminiPart[]): Promise<string> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new GeminiError('GOOGLE_GENERATIVE_AI_API_KEY is not set', 500);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiError(`Gemini ${res.status}: ${detail.slice(0, 500)}`, res.status);
  }
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (body.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
}
