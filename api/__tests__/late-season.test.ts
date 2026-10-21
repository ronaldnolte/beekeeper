import { describe, it, expect } from '@jest/globals';
import { runV2Pipeline, WeatherDay } from '../_nectar-v2-engine';
import type { MultiBandRecord } from '../_bands-fetcher';

// Late-season correction (added 2026-10-21): an unusually wet autumn greened the landscape
// and the index read as the best flow of the year on 21 October. Green is not nectar.
// Fixed calendar dates, so these do not depend on today's date.

const LAT = 35;
const DAY_MS = 86_400_000;
const START = Date.UTC(2025, 2, 1);          // 1 March 2025
const DAYS = 245;                            // through 1 November 2025
const iso = (d: number) => new Date(START + d * DAY_MS).toISOString().slice(0, 10);
const dayIdx = (date: string) => Math.round((Date.parse(date) - START) / DAY_MS);

// Spring green-up (Mar-May), a summer plateau, then a rain-driven green-up in October.
const green = (d: number): number => {
  const date = iso(d);
  if (date < '2025-04-01') return 0.25;
  if (date < '2025-05-15') return 0.25 + (0.45 * (d - dayIdx('2025-04-01'))) / 44;
  if (date < '2025-09-25') return 0.7;
  if (date < '2025-10-01') return 0.3;                       // dried off
  return 0.3 + (0.35 * (d - dayIdx('2025-10-01'))) / 30;     // October rain green-up
};

const records: MultiBandRecord[] = [];
for (let d = 0; d < DAYS; d += 5) {
  const g = green(d);
  records.push({ date: iso(d), ndvi: g, evi: g, ndwi: 0.2 });
}
const weather: Record<string, WeatherDay> = {};
for (let d = 0; d < DAYS; d++) weather[iso(d)] = { tmax: 80, tmin: 58, dew: 40 };

const run = (params = {}) => runV2Pipeline(records, weather, LAT, params, '2025-11-01');
const at = (r: ReturnType<typeof run>, date: string) => r.idxEwma[r.dates.indexOf(date)];

describe('late-season correction', () => {
  const corrected = run();
  const off = run({ taperStartHrs: 0, rateVigorExp: 0 });

  it('leaves the spring flow untouched', () => {
    for (const date of ['2025-04-20', '2025-05-10', '2025-07-15', '2025-09-15']) {
      expect(at(corrected, date)).toBeCloseTo(at(off, date), 10);
    }
  });

  it('pulls down a rain-driven green-up in late October', () => {
    const before = at(off, '2025-10-25');
    expect(before).toBeGreaterThan(0.1);                      // the uncorrected index is clearly a flow
    expect(at(corrected, '2025-10-25')).toBeLessThan(before * 0.7);
  });

  it('never raises the index', () => {
    for (let i = 0; i < corrected.dates.length; i++) {
      expect(corrected.idxEwma[i]).toBeLessThanOrEqual(off.idxEwma[i] + 1e-9);
    }
  });
});
