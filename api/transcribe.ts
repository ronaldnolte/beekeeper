import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyCors, getAuthedUser } from './_lib.js';

// Transcribe an inspection voice note with Gemini, then write the text back to
// the attachment row (user-scoped, so RLS still applies). Mirrors api/chat.ts.

// A full minute of Hands-free dictation can take Gemini well over the default
// function time limit to transcribe; allow up to a minute.
export const config = { maxDuration: 60 };

/** Strip any codecs parameter so Gemini gets a clean container mime type. */
function normalizeMime(mime: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  return base || 'audio/webm';
}

/** Core instructions for every recording (exported for the scripts in scripts/). */
export const TRANSCRIBE_BASE_PROMPT =
  'Transcribe this beekeeping inspection voice note verbatim into plain text. ' +
  'Return only the spoken words, with no preamble, commentary, or quotation marks. ' +
  'The recording is made at an open beehive: ignore bees buzzing, wind, smoker noise, ' +
  'birds, traffic and any other background sound. Never describe sounds (no "[buzzing]") ' +
  'and never guess words that were not clearly spoken by the beekeeper. ' +
  'If nothing intelligible was said, return an empty string.';

/** Spelling help for beekeeping terms (fixed "varroa mites", "burr comb", "pupae" in tests). */
export const TRANSCRIBE_WORD_LIST =
  ' Beekeeping words you may hear: varroa, varroa mites, pupae, larvae, brood, capped brood, ' +
  'drone brood, supersedure, swarm cells, queen cells, queen cups, queenright, queenless, ' +
  'propolis, burr comb, brace comb, cross comb, chalkbrood, nectar, dearth, foundation, ' +
  'frame, super, honey super, deep, medium, queen excluder, inner cover, follower board, ' +
  'top bar, bar, sugar roll, alcohol wash, small hive beetle, wax moth, nuc.';

/** What the app actually sends. */
export const TRANSCRIBE_PROMPT = TRANSCRIBE_BASE_PROMPT + TRANSCRIBE_WORD_LIST;

/**
 * Gemini 3.5 Flash-Lite with the word list above: the most accurate and cheapest of five
 * setups tested 2026-10-25 (scripts/compare-transcription-models.ts — no word errors with a
 * simulated bee buzz; ~2.0 cents per 20 minutes against ~4.9 for 2.5 Flash). 2.5 Flash-Lite
 * is no longer offered to new accounts.
 */
export const TRANSCRIBE_MODEL = 'gemini-3.5-flash-lite';

/**
 * No "thinking" for transcription: writing down speech needs no reasoning. Gemini 3 models
 * take thinkingLevel ("minimal" = none) and reject the older thinkingBudget: 0. Not in this
 * older library's types, but passed through to Google as-is.
 */
export const TRANSCRIBE_GENERATION_CONFIG = { thinkingConfig: { thinkingLevel: 'minimal' } } as any;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { attachmentId, audioBase64, mimeType, audioPath, sessionToken } = req.body;
    // Hands-free "ready check": transcribe a short test clip and hand the text
    // back without storing anything. Additive — existing callers never send it.
    const checkOnly = req.body.checkOnly === true;

    if ((!attachmentId && !checkOnly) || !audioBase64) {
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
    const model = genAI.getGenerativeModel({
      model: TRANSCRIBE_MODEL,
      generationConfig: TRANSCRIBE_GENERATION_CONFIG,
    });

    const prompt = TRANSCRIBE_PROMPT;

    const result = await model.generateContent([
      { inlineData: { mimeType: normalizeMime(mimeType), data: audioBase64 } },
      prompt,
    ]);

    const transcript = (result.response.text() || '').trim();

    if (checkOnly) {
      res.status(200).json({ transcript });
      return;
    }

    // Write back FIRST (RLS: only the owner's own row updates), audio_path
    // cleared. Only once the text is safely stored is the audio deleted — the
    // other way round, a failed write lost both the text and the audio.
    const { error: updErr } = await supabase
      .from('inspection_attachments')
      .update({ transcript, transcript_status: 'done', audio_path: null })
      .eq('id', attachmentId);

    if (updErr) {
      console.error('Transcribe: row update failed', updErr);
      res.status(500).json({ error: 'Transcribed, but could not store the transcript.' });
      return;
    }

    // Transcript is now the record of truth — drop the audio.
    // (Decision 2026-06-18: don't keep audio for review; users edit text inline,
    // and transcription is fast. Audio is only kept when transcription FAILS.)
    if (audioPath) {
      const { error: rmErr } = await supabase.storage.from('inspection-images').remove([audioPath]);
      if (rmErr) console.warn('Transcribe: could not remove audio object', rmErr.message);
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
