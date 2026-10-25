import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { applyCors, getAuthedUser } from './_lib.js';

// Hands-free inspection summary. Reads the inspection's dictation (voice-note
// transcripts + photo captions, in spoken order) and the hive's layout, and asks
// Gemini for a short summary, location-by-location notes (bar N / box N frame M),
// action items, and suggested answers for the inspection form. Nothing is
// written here — the app shows the result for the beekeeper to confirm.
//
// Reads with the user's own token (RLS), so like api/transcribe it must be
// called same-origin on web (see inspectionAttachmentRepository).

export const config = { maxDuration: 60 };

// Form answer values — must match src/features/inspection/inspectionOptions.ts.
// 'unknown' = not mentioned in the dictation (shown as "Not recorded").
const QUEEN = ['seen', 'eggs_present', 'larvae_present', 'capped_brood', 'virgin', 'no_queen', 'queen_cells', 'unknown'];
const BROOD = ['excellent', 'good', 'spotty', 'poor', 'unknown'];
const TEMPER = ['calm', 'moderate', 'defensive', 'aggressive', 'unknown'];
const STORES = ['none', 'low', 'adequate', 'abundant', 'unknown'];

const enumField = (values: string[], description: string) => ({
  type: SchemaType.STRING as const,
  format: 'enum' as const,
  enum: values,
  description,
});
const textField = (description: string) => ({ type: SchemaType.STRING as const, description });

export const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: textField('2–4 plain sentences summarising the inspection.'),
    locations: {
      type: SchemaType.ARRAY,
      description: 'Notes per location the beekeeper named, in hive order. Empty if no locations were named.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          location: textField('Exactly as identified, e.g. "Bar 12", "Bars 15–30", "Box 2, frame 4".'),
          notes: textField('What was observed there, briefly.'),
        },
        required: ['location', 'notes'],
      },
    },
    actions: {
      type: SchemaType.ARRAY,
      description: 'Follow-up actions the beekeeper said or that clearly follow (e.g. re-check queen cells in 5 days). Empty if none.',
      items: textField('One action.'),
    },
    queen_status: enumField(QUEEN, 'Queen status'),
    queen_evidence: textField('Short quote or paraphrase supporting the queen answer; empty if unknown.'),
    brood_pattern: enumField(BROOD, 'Brood pattern'),
    brood_evidence: textField('Supporting words; empty if unknown.'),
    temperament: enumField(TEMPER, 'Temperament'),
    temperament_evidence: textField('Supporting words; empty if unknown.'),
    honey_stores: enumField(STORES, 'Honey stores, whole hive'),
    honey_evidence: textField('Supporting words; empty if unknown.'),
    pollen_stores: enumField(STORES, 'Pollen stores, whole hive'),
    pollen_evidence: textField('Supporting words; empty if unknown.'),
  },
  required: [
    'summary', 'locations', 'actions',
    'queen_status', 'queen_evidence', 'brood_pattern', 'brood_evidence',
    'temperament', 'temperament_evidence', 'honey_stores', 'honey_evidence',
    'pollen_stores', 'pollen_evidence',
  ],
};

function parseJson(text: any): any {
  if (!text) return null;
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Describe the hive's layout in words the model (and beekeeper) use. */
export function describeLayout(hive: any): string {
  const type = String(hive?.type ?? '').toLowerCase();
  const isLangstroth = type.includes('langstroth') && !type.includes('long');
  const bars = parseJson(hive?.bars);
  if (isLangstroth) {
    // Stored top of stack first; beekeepers count boxes from the bottom.
    const stack = Array.isArray(bars) ? [...bars].reverse() : [];
    const boxes = stack.filter((b: any) => ['deep', 'medium', 'shallow'].includes(b?.type));
    if (boxes.length === 0) return 'Langstroth hive (box layout not recorded in the app).';
    const list = boxes
      .map((b: any, i: number) => `Box ${i + 1} (from the bottom): ${b.type}${b.frames ? `, ${b.frames} frames` : ''}`)
      .join('; ');
    return `Langstroth hive. ${list}.`;
  }
  const count = Array.isArray(bars) ? bars.length : hive?.bar_count;
  return `Horizontal / top-bar style hive (${hive?.type || 'type not set'})${count ? ` with ${count} bars` : ''}. Bars are numbered from 1.`;
}

/** The instructions sent to Gemini (exported so it can be tried outside the server). */
export function buildPrompt(p: { hiveName: string; layout: string; place: string; date: string; dictation: string }): string {
  const { hiveName, layout, place, date, dictation } = p;
  return `You are helping a beekeeper record a hive inspection they dictated while working.

HIVE: ${hiveName}. ${layout}
${place}Inspection date: ${date}.

DICTATION (speech-to-text, in the order spoken; [Photo N] marks where a photo was taken):
"""
${dictation}
"""

Instructions:
- Use ONLY what the beekeeper said. Never invent bar/box/frame numbers, observations or counts.
- Speech-to-text may contain small errors; read sensibly (e.g. "bar thirteen" = Bar 13).
- locations: group consecutive locations with the same finding (e.g. "Bars 15–30: empty").
  For Langstroth, name locations as "Box N" or "Box N, frame M" as the beekeeper did.
- Form answers: choose the single best value, or "unknown" if the dictation does not say.
  queen_status: seen = queen herself seen; eggs_present = eggs seen; larvae_present = young
  larvae seen; capped_brood = only capped brood mentioned; virgin = virgin queen; no_queen =
  beekeeper says the hive is queenless; queen_cells = queen cells or supersedure/swarm cells.
  If queen cells or queenlessness are mentioned, choose that (it needs action); otherwise prefer
  seen > eggs_present > larvae_present > capped_brood.
  brood_pattern: excellent = solid/tight, good, spotty, poor.
  temperament: calm, moderate, defensive, aggressive.
  honey_stores / pollen_stores for the whole hive: none, low = some, adequate = about half,
  abundant = plenty/full.
- Keep the summary short, plain and practical. No headings or markdown.`;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { inspectionId, sessionToken } = req.body ?? {};
    if (!inspectionId) {
      res.status(400).json({ error: 'Missing inspectionId.' });
      return;
    }

    const auth = await getAuthedUser(sessionToken);
    if (!auth) {
      res.status(401).json({ error: 'You must be signed in to summarise an inspection.' });
      return;
    }
    const { supabase } = auth;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
      res.status(500).json({ error: 'Summary service unavailable (configuration error).' });
      return;
    }

    const { data: inspection, error: inspErr } = await supabase
      .from('inspections')
      .select('id, hive_id, timestamp')
      .eq('id', inspectionId)
      .single();
    if (inspErr || !inspection) {
      res.status(404).json({ error: 'Inspection not found.' });
      return;
    }

    const { data: hive } = await supabase
      .from('hives')
      .select('name, type, bars, bar_count, apiary_id')
      .eq('id', inspection.hive_id)
      .single();

    let place = '';
    if (hive?.apiary_id) {
      const { data: apiary } = await supabase
        .from('apiaries')
        .select('zip_code, latitude')
        .eq('id', hive.apiary_id)
        .single();
      if (apiary?.zip_code) place = `Apiary location: ${apiary.zip_code}. `;
      if (typeof apiary?.latitude === 'number') {
        place += `Hemisphere: ${apiary.latitude >= 0 ? 'northern' : 'southern'}. `;
      }
    }

    const { data: rows, error: attErr } = await supabase
      .from('inspection_attachments')
      .select('id, kind, parent_id, transcript, transcript_status')
      .eq('inspection_id', inspectionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (attErr) throw attErr;

    // Rebuild the dictation in spoken order: parts of talk with photos between.
    const list = rows ?? [];
    const captionFor = (id: string) => list.find((r: any) => r.kind === 'voice_note' && r.parent_id === id);
    const lines: string[] = [];
    let photo = 0;
    for (const r of list as any[]) {
      if (r.kind === 'photo') {
        photo += 1;
        const cap = captionFor(r.id);
        lines.push(`[Photo ${photo}${cap?.transcript ? ` — caption: "${cap.transcript.trim()}"` : ''}]`);
      } else if (!r.parent_id && r.transcript_status === 'done' && r.transcript?.trim()) {
        lines.push(r.transcript.trim());
      }
    }
    const dictation = lines.join('\n');
    if (!dictation.replace(/\[Photo \d+\]/g, '').trim()) {
      res.status(422).json({ error: 'There is no dictation to summarise yet.' });
      return;
    }

    const date = new Date(inspection.timestamp).toISOString().slice(0, 10);
    const prompt = buildPrompt({ hiveName: hive?.name ?? 'Unnamed hive', layout: describeLayout(hive), place, date, dictation });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(prompt);
    const parsed = parseJson(result.response.text());
    if (!parsed || typeof parsed.summary !== 'string') {
      res.status(502).json({ error: 'The summary came back in an unexpected shape. Try again.' });
      return;
    }

    const pick = (v: any, allowed: string[]) => (allowed.includes(v) ? v : 'unknown');
    res.status(200).json({
      summary: parsed.summary.trim(),
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      form: {
        queen_status: { value: pick(parsed.queen_status, QUEEN), evidence: parsed.queen_evidence ?? '' },
        brood_pattern: { value: pick(parsed.brood_pattern, BROOD), evidence: parsed.brood_evidence ?? '' },
        temperament: { value: pick(parsed.temperament, TEMPER), evidence: parsed.temperament_evidence ?? '' },
        honey_stores: { value: pick(parsed.honey_stores, STORES), evidence: parsed.honey_evidence ?? '' },
        pollen_stores: { value: pick(parsed.pollen_stores, STORES), evidence: parsed.pollen_evidence ?? '' },
      },
    });
  } catch (error: any) {
    console.error('Summarize error:', error);
    if (error.message?.includes('429') || error.status === 429) {
      res.status(429).json({ error: 'Busy (rate limit). Try again shortly.' });
      return;
    }
    res.status(500).json({ error: 'Could not summarise the inspection. Please try again.' });
  }
}
