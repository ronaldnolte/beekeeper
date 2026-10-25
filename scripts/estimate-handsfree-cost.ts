// What does one Hands-free inspection cost in Gemini fees?
//
// Runs the same Gemini calls the app makes, with the same instructions, and reads
// Google's own usage counts back from each answer:
//   1. a 4-second ready-check clip,
//   2. one full minute of dictation (made with Windows' built-in voice),
//   3. the end-of-inspection summary for a 20-minute dictation.
// Then scales to a whole inspection. Costs a fraction of a cent to run.
//
// Run:  npx tsx scripts/estimate-handsfree-cost.ts
// Needs GOOGLE_GENERATIVE_AI_API_KEY in .env, and Windows (for the voice).
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TRANSCRIBE_PROMPT } from '../api/transcribe.ts';
import { buildPrompt, describeLayout, RESPONSE_SCHEMA } from '../api/summarize-inspection.ts';

// Gemini 2.5 Flash, paid tier, US dollars per million tokens
// (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-25).
const PRICE = { audioIn: 1.0, textIn: 0.3, out: 2.5 };
const INSPECTION_MINUTES = 20; // a typical inspection's dictation
const MODEL = 'gemini-2.5-flash';

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

const dollars = (u: Usage) =>
  (u.audioIn * PRICE.audioIn + u.textIn * PRICE.textIn + (u.out + u.thinking) * PRICE.out) / 1e6;

const fmt = (d: number) => (d < 0.01 ? `${(d * 100).toFixed(3)}¢` : `$${d.toFixed(4)}`);
const line = (label: string, u: Usage) =>
  `${label.padEnd(34)} audio ${String(Math.round(u.audioIn)).padStart(5)}  text ${String(Math.round(u.textIn)).padStart(5)}  ` +
  `answer ${String(Math.round(u.out)).padStart(5)}  thinking ${String(Math.round(u.thinking)).padStart(5)}  = ${fmt(dollars(u))}`;

async function transcribe(wav: Buffer, thinkingOff = false) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    // thinkingConfig isn't in this older library's types, but is passed through to Google.
    ...(thinkingOff ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any } : {}),
  });
  const res = await model.generateContent([
    { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
    TRANSCRIBE_PROMPT,
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
  const pieceNoThinking = await transcribe(minute, true);
  console.log('Gemini heard:\n  ' + piece.text + '\n');

  // Summary of a full inspection: the minute's text repeated with different bar numbers.
  const dictation = Array.from({ length: INSPECTION_MINUTES }, (_, i) =>
    piece.text.replace(/\b(\d+|thirty|twenty \w+|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen)\b/gi,
      (m) => (/^\d+$/.test(m) ? String(Number(m) + i) : m))
  ).join('\n');
  const summaryModel = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
  });
  const summaryRes = await summaryModel.generateContent(buildPrompt({
    hiveName: 'Test hive',
    layout: describeLayout({ type: 'top_bar', bar_count: 30 }),
    place: 'Hemisphere: northern. ',
    date: '2026-10-25',
    dictation,
  }));
  const summary = usageOf(summaryRes);

  // Scale one minute to the whole dictation.
  const perMinute = (u: Usage): Usage => {
    const k = 60 / minuteSecs;
    return { audioIn: u.audioIn * k, textIn: u.textIn * k, out: u.out * k, thinking: u.thinking * k };
  };
  const m = perMinute(piece.usage);
  const mOff = perMinute(pieceNoThinking.usage);
  const times = (u: Usage, n: number): Usage =>
    ({ audioIn: u.audioIn * n, textIn: u.textIn * n, out: u.out * n, thinking: u.thinking * n });

  console.log('Measured (Google\'s own token counts):');
  console.log(line('Ready check (4 s clip)', readyCheck.usage));
  console.log(line(`One minute of dictation`, m));
  console.log(line(`  same, with thinking switched off`, mOff));
  console.log(line(`Summary of ${INSPECTION_MINUTES} minutes`, summary));

  const total = dollars(readyCheck.usage) + dollars(times(m, INSPECTION_MINUTES)) + dollars(summary);
  const totalOff = dollars(readyCheck.usage) + dollars(times(mOff, INSPECTION_MINUTES)) + dollars(summary);
  console.log(`\nOne ${INSPECTION_MINUTES}-minute Hands-free inspection: ${fmt(total)}  (thinking off for dictation: ${fmt(totalOff)})`);
  console.log(`100 inspections: $${(total * 100).toFixed(2)}  (thinking off: $${(totalOff * 100).toFixed(2)})`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
