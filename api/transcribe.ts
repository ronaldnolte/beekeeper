// POST /api/transcribe — voice note → text, written back to the attachment (SPEC D §4).
// Token in the body (installed phone builds send exactly this shape). Called same-origin on the
// web so it writes to the database of the deployment it runs on (SCAR S-API-2).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, methodNotAllowed } from './_http.js';
import { getSignedInUser } from './_supabase.js';
import { generate, isRateLimit } from './_gemini.js';

export const INSTRUCTION =
  'Transcribe this beekeeping inspection voice note verbatim into plain text. Return only the spoken words, with no preamble, commentary, or quotation marks. If nothing intelligible was said, return an empty string.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const { attachmentId, audioBase64, mimeType, audioPath, sessionToken } = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
    if (!attachmentId || !audioBase64) return res.status(400).json({ error: 'Missing attachmentId or audio.' });

    const auth = await getSignedInUser(typeof sessionToken === 'string' ? sessionToken : null);
    if (!auth) return res.status(401).json({ error: 'You must be signed in to transcribe voice notes.' });
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return res.status(500).json({ error: 'Transcription service unavailable (configuration error).' });
    }

    const mime = (typeof mimeType === 'string' && mimeType ? mimeType.split(';')[0].toLowerCase() : '') || 'audio/webm';
    let transcript: string;
    try {
      transcript = (await generate([{ inline_data: { mime_type: mime, data: String(audioBase64) } }, { text: INSTRUCTION }])).trim();
    } catch (err) {
      console.error('[transcribe] model', err);
      if (isRateLimit(err)) return res.status(429).json({ error: 'Busy (rate limit). Try again shortly.' });
      return res.status(500).json({ error: 'Transcription failed. Please try again.' });
    }

    // As the user: delete the audio (log and continue on failure), then store the text.
    if (typeof audioPath === 'string' && audioPath) {
      const { error } = await auth.client.storage.from('inspection-images').remove([audioPath]);
      if (error) console.warn('[transcribe] audio delete failed', error.message);
    }
    const { error: updErr } = await auth.client
      .from('inspection_attachments')
      .update({ transcript, transcript_status: 'done', audio_path: null })
      .eq('id', String(attachmentId));
    if (updErr) {
      console.error('[transcribe] update', updErr);
      return res.status(500).json({ error: 'Transcribed, but could not store the transcript.' });
    }
    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('[transcribe]', err);
    return res.status(500).json({ error: 'Transcription failed. Please try again.' });
  }
}
