import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyCors, getAuthedUser } from './_lib.js';

// Transcribe an inspection voice note with Gemini, then write the text back to
// the attachment row (user-scoped, so RLS still applies). Mirrors api/chat.ts.

/** Strip any codecs parameter so Gemini gets a clean container mime type. */
function normalizeMime(mime: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  return base || 'audio/webm';
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { attachmentId, audioBase64, mimeType, audioPath, sessionToken } = req.body;

    if (!attachmentId || !audioBase64) {
      res.status(400).json({ error: 'Missing attachmentId or audio.' });
      return;
    }

    // Require a real signed-in user before doing any paid AI work. The returned
    // client is scoped to their token, so RLS still gates the write-back below.
    const auth = await getAuthedUser(sessionToken);
    if (!auth) {
      res.status(401).json({ error: 'You must be signed in to transcribe voice notes.' });
      return;
    }
    const { supabase } = auth;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
      res.status(500).json({ error: 'Transcription service unavailable (configuration error).' });
      return;
    }

    // Transcribe
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt =
      'Transcribe this beekeeping inspection voice note verbatim into plain text. ' +
      'Return only the spoken words, with no preamble, commentary, or quotation marks. ' +
      'If nothing intelligible was said, return an empty string.';

    const result = await model.generateContent([
      { inlineData: { mimeType: normalizeMime(mimeType), data: audioBase64 } },
      prompt,
    ]);

    const transcript = (result.response.text() || '').trim();

    // Transcript is now the record of truth — drop the audio immediately.
    // (Decision 2026-06-18: don't keep audio for review; users edit text inline,
    // and transcription is fast. Audio is only kept when transcription FAILS.)
    if (audioPath) {
      const { error: rmErr } = await supabase.storage.from('inspection-images').remove([audioPath]);
      if (rmErr) console.warn('Transcribe: could not remove audio object', rmErr.message);
    }

    // Write back (RLS: only the owner's own row updates). audio_path cleared.
    const { error: updErr } = await supabase
      .from('inspection_attachments')
      .update({ transcript, transcript_status: 'done', audio_path: null })
      .eq('id', attachmentId);

    if (updErr) {
      console.error('Transcribe: row update failed', updErr);
      res.status(500).json({ error: 'Transcribed, but could not store the transcript.' });
      return;
    }

    res.status(200).json({ transcript });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    if (error.message?.includes('429') || error.status === 429) {
      res.status(429).json({ error: 'Busy (rate limit). Try again shortly.' });
      return;
    }
    res.status(500).json({ error: 'Transcription failed. Please try again.' });
  }
}
