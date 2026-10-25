import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

/** One suggested form answer, with the words from the dictation behind it. */
export interface SuggestedAnswer {
  value: string; // an option value from inspectionOptions, or 'unknown' (not recorded)
  evidence: string;
}

export interface InspectionSummary {
  summary: string;
  locations: { location: string; notes: string }[];
  actions: string[];
  form: {
    queen_status: SuggestedAnswer;
    brood_pattern: SuggestedAnswer;
    temperament: SuggestedAnswer;
    honey_stores: SuggestedAnswer;
    pollen_stores: SuggestedAnswer;
  };
}

/**
 * Ask Gemini (api/summarize-inspection) to summarise a Hands-free inspection's
 * dictation and suggest form answers. Reads the database with the user's
 * token, so — like transcription — web calls its own same-origin function.
 */
export async function summarizeInspection(inspectionId: string): Promise<InspectionSummary> {
  const { data: { session } } = await supabase.auth.getSession();
  const apiUrl = Capacitor.isNativePlatform()
    ? 'https://beekeeper.beektools.com/api/summarize-inspection'
    : '/api/summarize-inspection';

  // A busy/overloaded answer is usually momentary — one retry after a pause.
  let lastError = 'Could not summarise the inspection.';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 4000));
    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId, sessionToken: session?.access_token }),
      });
    } catch {
      lastError = 'Could not reach the summary service — check your signal.';
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body as InspectionSummary;
    lastError = body.error || `Could not summarise the inspection (${res.status}).`;
    if (!(res.status === 429 || res.status >= 500)) break;
  }
  throw new Error(lastError);
}

/** The summary as plain text for the top of the Notes field. */
export function summaryToNotes(s: InspectionSummary): string {
  const blocks: string[] = [`Summary: ${s.summary}`];
  if (s.locations.length > 0) {
    blocks.push(['By location:', ...s.locations.map((l) => `• ${l.location}: ${l.notes}`)].join('\n'));
  }
  if (s.actions.length > 0) {
    blocks.push(['To do:', ...s.actions.map((a) => `• ${a}`)].join('\n'));
  }
  return blocks.join('\n\n');
}
