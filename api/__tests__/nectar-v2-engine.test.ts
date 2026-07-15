import { describe, it, expect } from '@jest/globals';
import { runV2Pipeline, WeatherDay, Phase } from '../nectar-v2-engine';
import type { MultiBandRecord } from '../bands-fetcher';

const DAY_MS = 86_400_000;
const LAT = 35;
const TOTAL_DAYS = 240;

// Timeline ends today so the pipeline doesn't pad a long forward-filled tail
// (it always extends the daily grid to the current date).
const START = new Date(Date.now() - (TOTAL_DAYS - 1) * DAY_MS);

function iso(dayIdx: number): string {
  return new Date(START.getTime() + dayIdx * DAY_MS).toISOString().slice(0, 10);
}

/** Satellite scenes every 5 days; greenness/ndwi given per day index. */
function makeRecords(
  green: (d: number) => number,
  ndwi: (d: number) => number
): MultiBandRecord[] {
  const recs: MultiBandRecord[] = [];
  for (let d = 0; d < TOTAL_DAYS; d += 5) {
    const g = green(d);
    recs.push({ date: iso(d), ndvi: g, evi: g, ndwi: ndwi(d) });
  }
  return recs;
}

/** Weather for every day. Dew 40°F keeps the fall-bloom term at zero
 *  (below its 45°F moisture floor) so tests only exercise the rate core. */
function makeWeather(tmax: number, tmin: number): Record<string, WeatherDay> {
  const out: Record<string, WeatherDay> = {};
  for (let d = 0; d < TOTAL_DAYS; d++) {
    out[iso(d)] = { tmax, tmin, dew: 40 };
  }
  return out;
}

// One spring-flow season: flat 0.2 → ramp to 0.8 (days 60–120) → plateau →
// ramp back down (days 150–210) → flat.
const seasonGreen = (d: number): number => {
  if (d < 60) return 0.2;
  if (d < 120) return 0.2 + (0.6 * (d - 60)) / 60;
  if (d < 150) return 0.8;
  if (d < 210) return 0.8 - (0.6 * (d - 150)) / 60;
  return 0.2;
};

describe('V2 nectar pipeline — phase classification', () => {
  const result = runV2Pipeline(
    makeRecords(seasonGreen, () => 0.2),
    makeWeather(80, 60),
    LAT
  );

  it('classifies a sustained green-up as IN_FLOW while the index is high', () => {
    expect(result.phases).toContain('IN_FLOW');
  });

  it('orders the phases: starting before peak, ending after peak', () => {
    const firstStart = result.phases.indexOf('FLOW_STARTING');
    const firstPeak = result.phases.indexOf('IN_FLOW');
    const lastPeak = result.phases.lastIndexOf('IN_FLOW');
    const ending = result.phases.slice(lastPeak).indexOf('FLOW_ENDING');
    expect(firstStart).toBeGreaterThanOrEqual(0);
    expect(firstPeak).toBeGreaterThan(firstStart);
    expect(ending).toBeGreaterThan(0);
  });

  it('lands in DEARTH once the season is over', () => {
    expect(result.phases[result.phases.length - 1]).toBe('DEARTH');
  });

  it('never flips phase for fewer than the dwell length', () => {
    const runs: { phase: Phase; len: number }[] = [];
    for (const p of result.phases) {
      const last = runs[runs.length - 1];
      if (last && last.phase === p) last.len++;
      else runs.push({ phase: p, len: 1 });
    }
    // Every settled run must last >= dwell (3). The first run is the seed
    // placeholder and the last is the live tail — both may be shorter.
    for (const r of runs.slice(1, -1)) {
      expect(r.len).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('V2 nectar pipeline — moisture modifier', () => {
  // Same greenness curve; NDWI relatively wet during the flow in one run,
  // relatively dry during it in the other (percentile-normalized per site).
  const wetDuringFlow = runV2Pipeline(
    makeRecords(seasonGreen, d => (d < 150 ? 0.4 : 0.0)),
    makeWeather(80, 60),
    LAT
  );
  const dryDuringFlow = runV2Pipeline(
    makeRecords(seasonGreen, d => (d < 150 ? 0.0 : 0.4)),
    makeWeather(80, 60),
    LAT
  );

  it('a relatively dry flow period scores lower than a wet one', () => {
    const maxWet = Math.max(...wetDuringFlow.idxEwma);
    const maxDry = Math.max(...dryDuringFlow.idxEwma);
    expect(maxDry).toBeLessThan(maxWet);
  });

  it('the dry penalty is capped by the 0.7 floor', () => {
    const maxWet = Math.max(...wetDuringFlow.idxEwma);
    const maxDry = Math.max(...dryDuringFlow.idxEwma);
    expect(maxDry).toBeGreaterThanOrEqual(maxWet * 0.65); // floor 0.7 minus smoothing slack
  });
});

describe('V2 nectar pipeline — dormancy gate', () => {
  it('a cold-season green-up produces no flow', () => {
    const cold = runV2Pipeline(
      makeRecords(seasonGreen, () => 0.2),
      makeWeather(35, 25), // 14-day mean 30°F, below the 38°F dormancy floor
      LAT
    );
    expect(Math.max(...cold.idxEwma)).toBeLessThanOrEqual(0.01);
    expect(cold.phases).not.toContain('IN_FLOW');
    expect(cold.phases).not.toContain('FLOW_STARTING');
  });
});
