// Is a cheaper Gemini model good enough to transcribe Hands-free dictation?
//
// Makes three clips with Windows' built-in voice — an ordinary minute, a minute packed with
// beekeeping words, and that same minute with a simulated bee buzz mixed in — sends each to
// each model with the app's exact transcription instructions, and scores the result against
// what was actually said (word errors) and against Google's token counts (cost).
//
// Run:  npx tsx scripts/compare-transcription-models.ts
// Needs GOOGLE_GENERATIVE_AI_API_KEY in .env, and Windows (for the voice). Costs well under a cent.
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TRANSCRIBE_BASE_PROMPT, TRANSCRIBE_WORD_LIST, TRANSCRIBE_GENERATION_CONFIG } from '../api/transcribe.ts';

// US dollars per million tokens, paid tier (ai.google.dev/gemini-api/docs/pricing, 2026-10-25).
// (2.5 Flash-Lite is "no longer available to new users", so the newer Lite models are tried.)
type Price = { audioIn: number; textIn: number; out: number };
const CANDIDATES: { label: string; model: string; price: Price; glossary?: boolean }[] = [
  { label: '2.5 Flash (today)', model: 'gemini-2.5-flash', price: { audioIn: 1.0, textIn: 0.3, out: 2.5 } },
  { label: '2.5 Flash + word list', model: 'gemini-2.5-flash', price: { audioIn: 1.0, textIn: 0.3, out: 2.5 }, glossary: true },
  { label: '3.1 Flash-Lite', model: 'gemini-3.1-flash-lite', price: { audioIn: 0.5, textIn: 0.25, out: 1.5 } },
  { label: '3.1 Flash-Lite + word list', model: 'gemini-3.1-flash-lite', price: { audioIn: 0.5, textIn: 0.25, out: 1.5 }, glossary: true },
  { label: '3.5 Flash-Lite', model: 'gemini-3.5-flash-lite', price: { audioIn: 0.3, textIn: 0.3, out: 2.5 } },
  { label: '3.5 Flash-Lite + word list', model: 'gemini-3.5-flash-lite', price: { audioIn: 0.3, textIn: 0.3, out: 2.5 }, glossary: true },
];
const INSPECTION_MINUTES = 20;

const CLIPS: { name: string; text: string; buzz?: boolean }[] = [
  {
    name: 'Ordinary minute',
    text:
      'Okay, starting the inspection on the top bar hive. Bars thirty down to twenty two are empty, ' +
      'no comb yet. Bar twenty one has a little new white comb started. Bar twenty, honey, about ' +
      'half capped. Bar nineteen, honey, mostly capped, nice and heavy. Bar eighteen, pollen along ' +
      'the top, some capped honey. Bar seventeen, this is the start of the brood. Solid capped ' +
      'worker brood, good pattern. Bar sixteen, I can see eggs and young larvae, so the queen was ' +
      'here recently. Bar fifteen, more capped brood, a few drone cells along the bottom edge. ' +
      'Bees are calm today, hardly any smoke needed. Bar fourteen, I see two queen cups on the ' +
      'bottom, both empty. I will check those again next week. Moving on to bar thirteen.',
  },
  {
    name: 'Beekeeping words',
    text:
      'Box two, frame four. Supersedure cells near the middle of the frame, two of them capped. ' +
      'Lots of propolis on the inner cover. Spotty brood pattern with some chalkbrood mummies on ' +
      'the bottom board. Varroa mites visible on drone pupae, I will do a sugar roll and an alcohol ' +
      'wash. The queen excluder is clogged with burr comb. Foundation in frame nine is not drawn ' +
      'out yet. Nectar is coming in, uncapped and shiny. Pollen patties are mostly gone. The ' +
      'colony is queenright, I saw the marked queen on frame five. Add a honey super and an ' +
      'entrance reducer before the nectar dearth.',
  },
  { name: 'Same, with bee buzz', text: '', buzz: true },
];
CLIPS[2].text = CLIPS[1].text;

const env = readFileSync('.env', 'utf8');
const key = (env.match(/^GOOGLE_GENERATIVE_AI_API_KEY=(.*)$/m)?.[1] ?? '').trim().replace(/^"|"$/g, '');
if (!key) throw new Error('No GOOGLE_GENERATIVE_AI_API_KEY in .env');
const genAI = new GoogleGenerativeAI(key);

function makeSpeech(text: string, file: string) {
  const ps = `Add-Type -AssemblyName System.Speech; ` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; ` +
    `$s.SetOutputToWaveFile('${file}'); $s.Speak([Console]::In.ReadToEnd()); $s.Dispose()`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { input: text });
  if (!existsSync(file)) throw new Error('Speech file was not made');
}

/** Mix a bee-like buzz (wavering ~230 Hz hum plus hiss) into a 16-bit mono WAV. */
function addBuzz(wav: Buffer): Buffer {
  const out = Buffer.from(wav);
  const rate = out.readUInt32LE(24);
  for (let i = 44, n = 0; i + 1 < out.length; i += 2, n++) {
    const t = n / rate;
    const hum = Math.sin(2 * Math.PI * 230 * t + 3 * Math.sin(2 * Math.PI * 0.8 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t));
    const hiss = Math.random() * 2 - 1;
    const sample = out.readInt16LE(i) + (hum * 0.12 + hiss * 0.04) * 32767;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample))), i);
  }
  return out;
}

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
/** Words for comparing: lower case, no punctuation, "twenty two" and "22" both become "22". */
function words(text: string): string[] {
  const raw = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const outw: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const tens = ['twenty', 'thirty'].indexOf(w);
    if (tens >= 0) {
      const unit = SMALL.indexOf(raw[i + 1] ?? '');
      if (unit > 0 && unit < 10) { outw.push(String((tens + 2) * 10 + unit)); i++; continue; }
      outw.push(String((tens + 2) * 10)); continue;
    }
    const s = SMALL.indexOf(w);
    outw.push(s >= 0 ? String(s) : w);
  }
  return outw;
}

/** Word errors: insertions + deletions + substitutions needed to turn heard into said. */
function wordErrors(said: string[], heard: string[]): number {
  const d = Array.from({ length: said.length + 1 }, (_, i) => [i, ...Array(heard.length).fill(0)]);
  for (let j = 1; j <= heard.length; j++) d[0][j] = j;
  for (let i = 1; i <= said.length; i++)
    for (let j = 1; j <= heard.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (said[i - 1] === heard[j - 1] ? 0 : 1));
  return d[said.length][heard.length];
}

/** The words that came out differently, e.g. "supersedure → super seizure". */
function mistakes(said: string[], heard: string[]): string[] {
  const s = new Set(heard);
  return said.filter((w) => !s.has(w));
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'compare-models-'));
  const audio = CLIPS.map((c, i) => {
    const f = join(dir, `clip${i}.wav`);
    makeSpeech(c.text, f);
    let buf: Buffer = readFileSync(f);
    if (c.buzz) { buf = addBuzz(buf); writeFileSync(f, buf); }
    return buf;
  });
  const secs = audio.map((b) => (b.length - 44) / b.readUInt32LE(28));
  console.log(`Clips: ${secs.map((s) => s.toFixed(0) + ' s').join(', ')}  (audio files in ${dir})\n`);

  const costPerMinute: Record<string, number[]> = {};
  for (const cand of CANDIDATES) {
    const price = cand.price;
    const modelName = cand.label;
    const prompt = TRANSCRIBE_BASE_PROMPT + (cand.glossary ? TRANSCRIBE_WORD_LIST : '');
    // Thinking off as in the app; if a newer model rejects that setting, use its default.
    const run = async (clip: Buffer) => {
      const parts = [{ inlineData: { mimeType: 'audio/wav', data: clip.toString('base64') } }, prompt];
      try {
        return await genAI.getGenerativeModel({ model: cand.model, generationConfig: TRANSCRIBE_GENERATION_CONFIG })
          .generateContent(parts);
      } catch (e: any) {
        if (!/thinking|400|invalid argument/i.test(e?.message ?? '')) throw e;
        return await genAI.getGenerativeModel({ model: cand.model }).generateContent(parts);
      }
    };
    console.log(`=== ${modelName} ===`);
    costPerMinute[modelName] = [];
    for (let i = 0; i < CLIPS.length; i++) {
      const res = await run(audio[i]);
      const text = res.response.text().trim();
      const m: any = res.response.usageMetadata ?? {};
      const audioIn = (m.promptTokensDetails ?? []).filter((d: any) => d.modality === 'AUDIO')
        .reduce((a: number, d: any) => a + d.tokenCount, 0);
      const textIn = (m.promptTokenCount ?? 0) - audioIn;
      const out = (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0);
      const dollars = (audioIn * price.audioIn + textIn * price.textIn + out * price.out) / 1e6;
      costPerMinute[modelName].push((dollars * 60) / secs[i]);
      const said = words(CLIPS[i].text);
      const errs = wordErrors(said, words(text));
      const missed = mistakes(said, words(text));
      console.log(`${CLIPS[i].name.padEnd(20)} ${errs} word error(s) of ${said.length}` +
        (missed.length ? `  — not heard right: ${missed.join(', ')}` : ''));
      if (i === 1) console.log(`  heard: ${text}`);
    }
    const avg = costPerMinute[modelName].reduce((a, b) => a + b, 0) / CLIPS.length;
    console.log(`Cost: ${(avg * 100).toFixed(3)}¢ per minute, ${(avg * INSPECTION_MINUTES * 100).toFixed(2)}¢ ` +
      `for ${INSPECTION_MINUTES} minutes of dictation\n`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
