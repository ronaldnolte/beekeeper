// Forecast scoring vs the shipped scoring run on a saved Open-Meteo response (GOLDEN-OUTPUTS §3).
// The undisplayed legacy V1 score is not reproduced (FORMULAS §5 allows omitting it).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreForecast } from '../shared/forecast/scoring';

const G = join(__dirname, 'golden/forecast');
const input = JSON.parse(readFileSync(join(G, 'open-meteo-south-valley-2026-09-25.json'), 'utf8'));
const want = JSON.parse(readFileSync(join(G, 'forecast-windows-south-valley-2026-09-25.json'), 'utf8'));

describe('inspection forecast scoring (South Valley, 2026-09-25)', () => {
  const got = scoreForecast(input);

  it('produces the same 91 windows in the same order', () => {
    expect(got.map(w => `${w.date} ${w.hour}`)).toEqual(want.map((w: { date: string; hour: number }) => `${w.date} ${w.hour}`));
  });

  it('matches every window', () => {
    want.forEach((w: Record<string, unknown>, i: number) => {
      const g = got[i];
      const { legacyScoreV1: _a, legacyIssuesV1: _b, pressureDelta3hr, ...rest } = w;
      expect(Math.abs(g.pressureDelta3hr - (pressureDelta3hr as number)), `${w.date} ${w.hour} delta`).toBeLessThan(1e-9);
      const { pressureDelta3hr: _c, ...gRest } = g;
      expect(gRest, `${w.date} ${w.hour}`).toEqual(rest);
    });
  });
});
