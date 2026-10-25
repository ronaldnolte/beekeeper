// What does one Hands-free inspection cost in Gemini fees?
//
// Runs the same Gemini calls the app makes, with the same instructions and models, and
// reads Google's own usage counts back from each answer:
//   1. a 4-second ready-check clip,
//   2. one full minute of dictation (made with Windows' built-in voice),
//   3. the end-of-inspection summary for a 20-minute dictation.
// Then scales to a whole inspection, and compares with the setup the live site used before
// (2.5 Flash, thinking on, no word list). Costs well under a cent to run.
//
// Run:  npx tsx scripts/estimate-handsfree-cost.ts
// Needs GOOGLE_GENERATIVE_AI_API_KEY in .env, and Windows (for the voice).
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  TRANSCRIBE_PROMPT, TRANSCRIBE_BASE_PROMPT, TRANSCRIBE_MODEL, TRANSCRIBE_GENERATION_CONFIG,
} from '../api/transcribe.ts';
import { buildPrompt, describeLayout, RESPONSE_SCHEMA } from '../api/summarize-inspection.ts';

// US dollars per million tokens, paid tier (ai.google.dev/gemini-api/docs/pricing, 2026-10-25).
type Price = { audioIn: number; textIn: number; out: number };
const PRICES: Record<string, Price> = {
  'gemini-2.5-flash': { audioIn: 1.0, textIn: 0.3, out: 2.5 },
  'gemini-3.5-flash-lite': { audioIn: 0.3, textIn: 0.3, out: 2.5 },
  'gemini-3.1-flash-lite': { audioIn: 0.5, textIn: 0.25, out: 1.5 },
};
const SUMMARY_MODEL = 'gemini-2.5-flash'; // as in api/summarize-inspection.ts
const OLD_MODEL = 'gemini-2.5-flash';
const INSPECTION_MINUTES = 20; // a typical inspection's dictation

const env = readFileSync('.env', 'utf8');
const key = (env.match(/^GOOGLE_GENERATIVE_AI_API_KEY=(.*)$/m)?.[1] ?? '').trim().replace(/^"|"$/g, '');
if (!key) throw new Error('No GOOGLE_GENERATIVE_AI_API_KEY in .env');
const genAI = new GoogleGenerativeAI(key);

// About one minute of speech at a normal talking pace.
const MINUTE_OF_DICTATION =
  'Okay, starting the inspection on the top bar hive. Bars thirty down to twenty two are empty, ' +
  'no comb yet. Bar twenty one has a little new white comb started. Bar twenty, honey, about ' +
  'half capped. Bar nineteen, honey, mostly capped, nice and heavy. Bar eighteen, pollen along ' +
  'the top, some capped honey. Bar seventeen, this is the start of the brood. Solid capped ' +
  'worker brood, good pattern. Bar sixteen, I can see eggs and young larvae, so the queen was ' +
  'here recently. Bar fifteen, more capped brood, a few drone cells along the bottom edge. ' +
  'Bees are calm today, hardly any smoke needed. Bar fourteen, I see two queen cups on the ' +
  'bottom, both empty. I will check those again next week. Moving on to bar thirteen.';

function makeSpeech(text: string, file: string) {
  const ps = `Add-Type -AssemblyName System.Speech; ` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; ` +
    `$s.SetOutputToWaveFile('${file}'); $s.Speak([Console]::In.ReadToEnd()); $s.Dispose()`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { input: text });
  if (!existsSync(file)) throw new Error('Speech file was not made');
}

function wavSeconds(buf: Buffer): number {
  const byteRate = buf.readUInt32LE(28);
  return (buf.length - 44) / byteRate;
}

type Usage = { audioIn: number; textIn: number; out: number; thinking: number };

function usageOf(res: any): Usage {
  const m = res.response.usageMetadata ?? {};
  const details: any[] = m.promptTokensDetails ?? [];
  const audioIn = details.filter((d) => d.modality === 'AUDIO').reduce((a, d) => a + d.tokenCount, 0);
  const textIn = (m.promptTokenCount ?? 0) - audioIn;
  return { audioIn, textIn, out: m.candidatesTokenCount ?? 0, thinking: m.thoughtsTokenCount ?? 0 };
}

const dollars = (u: Usage, p: Price) =>
  (u.audioIn * p.audioIn + u.textIn * p.textIn + (u.out + u.thinking) * p.out) / 1e6;

const fmt = (d: number) => (d < 0.01 ? `${(d * 100).toFixed(3)}¢` : `$${d.toFixed(4)}`);
const line = (label: string, u: Usage, p: Price) =>
  `${label.padEnd(36)} audio ${String(Math.round(u.audioIn)).padStart(5)}  text ${String(Math.round(u.textIn)).padStart(5)}  ` +
  `answer ${String(Math.round(u.out)).padStart(5)}  thinking ${String(Math.round(u.thinking)).padStart(5)}  = ${fmt(dollars(u, p))}`;

/** Transcribe as the app does now, or (old = true) as the live site did before. */
async function transcribe(wav: Buffer, old = false) {
  const model = genAI.getGenerativeModel(old
    ? { model: OLD_MODEL }
    : { model: TRANSCRIBE_MODEL, generationConfig: TRANSCRIBE_GENERATION_CONFIG });
  const res = await model.generateContent([
    { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
    old ? TRANSCRIBE_BASE_PROMPT : TRANSCRIBE_PROMPT,
  ]);
  return { text: res.response.text().trim(), usage: usageOf(res) };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'handsfree-cost-'));
  const minuteWav = join(dir, 'minute.wav');
  const checkWav = join(dir, 'check.wav');
  makeSpeech(MINUTE_OF_DICTATION, minuteWav);
  makeSpeech('Testing, one, two, three.', checkWav);
  const minute = readFileSync(minuteWav);
  const check = readFileSync(checkWav);
  const minuteSecs = wavSeconds(minute);
  console.log(`Made a ${minuteSecs.toFixed(0)}-second dictation and a ${wavSeconds(check).toFixed(1)}-second test clip.\n`);

  const readyCheck = await transcribe(check);
  const piece = await transcribe(minute);
  const pieceOld = await transcribe(minute, true);
  console.log(`Gemini (${TRANSCRIBE_MODEL}) heard:\n  ${piece.text}\n`);

  // Summary of a full inspection: the minute's text repeated with different bar numbers.
  const dictation = Array.from({ length: INSPECTION_MINUTES }, (_, i) =>
    piece.text.replace(/\b\d+\b/g, (m) => String(Number(m) + i))).join('\n');
  const summaryRes = await genAI.getGenerativeModel({
    model: SUMMARY_MODEL,
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
  }).generateContent(buildPrompt({
    hiveName: 'Test hive',
    layout: describeLayout({ type: 'top_bar', bar_count: 30 }),
    place: 'Hemisphere: northern. ',
    date: '2026-10-25',
    dictation,
  }));
  const summary = usageOf(summaryRes);

  const perMinute = (u: Usage): Usage => {
    const k = 60 / minuteSecs;
    return { audioIn: u.audioIn * k, textIn: u.textIn * k, out: u.out * k, thinking: u.thinking * k };
  };
  const times = (u: Usage, n: number): Usage =>
    ({ audioIn: u.audioIn * n, textIn: u.textIn * n, out: u.out * n, thinking: u.thinking * n });
  const now = PRICES[TRANSCRIBE_MODEL];
  const old = PRICES[OLD_MODEL];
  const sum = PRICES[SUMMARY_MODEL];
  const m = perMinute(piece.usage);
  const mOld = perMinute(pieceOld.usage);

  console.log("Measured (Google's own token counts):");
  console.log(line('Ready check (4 s clip)', readyCheck.usage, now));
  console.log(line('One minute of dictation', m, now));
  console.log(line('  before (2.5 Flash, thinking on)', mOld, old));
  console.log(line(`Summary of ${INSPECTION_MINUTES} minutes`, summary, sum));

  const total = dollars(readyCheck.usage, now) + dollars(times(m, INSPECTION_MINUTES), now) + dollars(summary, sum);
  const totalOld = dollars(readyCheck.usage, old) + dollars(times(mOld, INSPECTION_MINUTES), old) + dollars(summary, sum);
  console.log(`\nOne ${INSPECTION_MINUTES}-minute Hands-free inspection: ${fmt(total)}  (before: ${fmt(totalOld)})`);
  console.log(`100 inspections: $${(total * 100).toFixed(2)}  (before: $${(totalOld * 100).toFixed(2)})`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
