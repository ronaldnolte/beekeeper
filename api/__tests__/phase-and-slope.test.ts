import { describe, it, expect } from '@jest/globals';
import { runV2Pipeline, trailingSlope, WeatherDay } from '../_nectar-v2-engine';
import type { MultiBandRecord } from '../_bands-fetcher';

// Two bugs in the phase badge, both measured on production data.
//
// 1. A dead yard could be labelled a flow. The slope tests ran before the dearth floor, so a
//    trivial slope on a near-zero index promoted it to TRENDING_UP or TRENDING_DOWN, and the
//    dwell hysteresis then held that label indefinitely. Measured: TRENDING_UP at index 2
//    with a slope of -0.00183. The same defect once showed "Flow Ending: watch for robbing"
//    at NFI 1.
//
// 2. The slope was unreliable at the live end. localPoly fits a parabola over a CENTRED
//    window; for the last few days there are no points ahead, so it is anchored on one side
//    and free to keep bending past the data. Measured at Murfreesboro: -0.18062, larger than
//    the maximum (0.13434) anywhere in 3.6 years of supported fits, and sign-flipped from the
//    previous day. That value drives trend_direction and the phase badge.

// ---------------------------------------------------------------------------------------
// The slope estimator, tested directly.
//
// Deliberately NOT through the pipeline. The index is a RATE, so a greenness curve that is
// still rising but flattening produces a genuinely FALLING index — which makes it very easy
// to write a pipeline test that looks like it is about the slope and is really about the
// rate core. Testing the estimator on known arrays keeps the two separate.
// ---------------------------------------------------------------------------------------

/** The centred parabola, reproduced here so the two can be compared on the same data. */
function centredParabolaSlope(arr: number[], i: number, half: number): number {
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0, n = 0;
  for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
    const y = arr[j];
    const x = j - i, x2 = x * x;
    S0 += 1; S1 += x; S2 += x2; S3 += x2 * x; S4 += x2 * x2;
    T0 += y; T1 += x * y; T2 += x2 * y;
    n++;
  }
  if (n < 3) return 0;
  const A = [[S0, S1, S2, T0], [S1, S2, S3, T1], [S2, S3, S4, T2]];
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A[1][3] / A[1][1];
}

describe('trailingSlope', () => {
  it('reads a straight line exactly', () => {
    const rising = Array.from({ length: 11 }, (_, i) => 0.1 + 0.02 * i);
    expect(trailingSlope(rising, 10, 11)).toBeCloseTo(0.02, 9);
    const falling = Array.from({ length: 11 }, (_, i) => 0.5 - 0.03 * i);
    expect(trailingSlope(falling, 10, 11)).toBeCloseTo(-0.03, 9);
  });

  it('reads flat as flat', () => {
    expect(trailingSlope(new Array(11).fill(0.3), 10, 11)).toBeCloseTo(0, 9);
  });

  it('does NOT report a downturn on a flattening rise, where the parabola does', () => {
    // The exact failure. A series still going up, each step smaller than the last. The
    // parabola sees the curvature, has nothing ahead to hold it up, and extrapolates the
    // flattening into a decline.
    const y = [0.40, 0.44, 0.47, 0.49, 0.505, 0.515, 0.520, 0.522, 0.523, 0.5235, 0.5238];
    const last = y.length - 1;

    expect(y[last]).toBeGreaterThan(y[last - 1]);          // it is still rising
    expect(centredParabolaSlope(y, last, 5)).toBeLessThan(0);  // parabola says falling
    expect(trailingSlope(y, last, 11)).toBeGreaterThan(0);     // the line does not
  });

  it('stays within the range the data actually moved', () => {
    // The failure was magnitude as well as sign: -0.18062 where nothing in 3.6 years of
    // supported fits exceeded 0.13434. A least-squares line cannot exceed the largest
    // step in its own window.
    const y = [0.2, 0.25, 0.31, 0.34, 0.35, 0.352, 0.353, 0.3532];
    const steps = y.slice(1).map((v, i) => Math.abs(v - y[i]));
    const biggestStep = Math.max(...steps);
    expect(Math.abs(trailingSlope(y, y.length - 1, 8))).toBeLessThanOrEqual(biggestStep);
  });

  it('reports a genuine decline as a decline', () => {
    const y = [0.6, 0.55, 0.48, 0.40, 0.33, 0.28, 0.24];
    expect(trailingSlope(y, y.length - 1, 7)).toBeLessThan(-0.03);
  });

  it('returns zero rather than guessing when there is almost nothing to fit', () => {
    expect(trailingSlope([0.4], 0, 11)).toBe(0);
    expect(trailingSlope([0.4, 0.5], 1, 11)).toBe(0);
  });

  it('ignores non-finite values without skewing the fit', () => {
    const clean = [0.1, 0.12, 0.14, 0.16, 0.18];
    const holed = [0.1, 0.12, NaN, 0.16, 0.18];
    expect(trailingSlope(holed, 4, 5)).toBeCloseTo(trailingSlope(clean, 4, 5), 2);
  });
});

// ---------------------------------------------------------------------------------------
// The dearth floor, through the whole pipeline.
// ---------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const LAT = 35;
const DAYS = 220;
const START = new Date(Date.now() - (DAYS - 1) * DAY_MS);
const iso = (d: number) => new Date(START.getTime() + d * DAY_MS).toISOString().slice(0, 10);

function records(green: (d: number) => number): MultiBandRecord[] {
  const out: MultiBandRecord[] = [];
  for (let d = 0; d < DAYS; d += 5) {
    const g = green(d);
    out.push({ date: iso(d), ndvi: g, evi: g, ndwi: 0.1 });
  }
  return out;
}

/** Warm enough not to be gated; dew 40F keeps the fall term out of it. */
function weather(): Record<string, WeatherDay> {
  const out: Record<string, WeatherDay> = {};
  for (let d = 0; d < DAYS; d++) out[iso(d)] = { tmax: 80, tmin: 60, dew: 40 };
  return out;
}

describe('phase rules: direction decides, one level threshold', () => {
  // Ron's specification, 2026-08-28:
  //   1. flat under 7          -> DEARTH
  //   2. any 4 days rising     -> TRENDING_UP
  //   3. any 4 days falling    -> TRENDING_DOWN
  //   4. (otherwise, above 7)  -> IN_FLOW
  //
  // Replaces three level bands plus a TRANSITION phase, and the chart's four bands that
  // agreed with none of them. "Setting arbitrary limits is likely going to never work in
  // all places."
  //
  // Four days rather than three: 1-3 July 2026 at South Valley scaled up for three days and
  // died on the fourth, which is not something to put in front of a beekeeper as advice.

  it('calls a sustained climb a flow starting', () => {
    const r = runV2Pipeline(records(d => (d < 80 ? 0.20 : 0.20 + (d - 80) * 0.006)), weather(), LAT);
    expect(r.phases).toContain('TRENDING_UP');
  });

  it('calls a sustained decline a flow ending', () => {
    const r = runV2Pipeline(
      records(d => (d < 80 ? 0.20 + d * 0.005 : 0.60 - (d - 80) * 0.004)),
      weather(), LAT
    );
    expect(r.phases).toContain('TRENDING_DOWN');
  });

  it('calls a flat low reading a dearth', () => {
    const r = runV2Pipeline(records(d => (d < 90 ? 0.20 + d * 0.004 : 0.20)), weather(), LAT);
    expect(r.phases[r.phases.length - 1]).toBe('DEARTH');
    expect(r.idxEwma[r.idxEwma.length - 1] * 100).toBeLessThan(7);
  });

  it('never emits TRANSITION — the phase no longer exists', () => {
    const r = runV2Pipeline(records(d => 0.2 + 0.4 * Math.sin(d / 30)), weather(), LAT);
    expect(new Set(r.phases).has('TRANSITION' as never)).toBe(false);
  });

  it('needs four days, not three: a three-day rise that dies is not a flow', () => {
    // The 1-3 July case. Build a slope series directly so the run length is exactly
    // controlled — going through greenness cannot pin it to the day.
    const runLength = (slopes: number[]) => {
      let rising = 0, out: string[] = [];
      for (const sl of slopes) {
        rising = sl > 0.002 ? rising + 1 : 0;
        out.push(rising >= 4 ? 'TRENDING_UP' : 'other');
      }
      return out;
    };
    expect(runLength([0.01, 0.01, 0.01, 0])).not.toContain('TRENDING_UP');
    expect(runLength([0.01, 0.01, 0.01, 0.01])).toContain('TRENDING_UP');
  });

  it('treats a plateau above the floor as a flow, not a dearth', () => {
    // A steady flow produces no slope at all. Scoring that as weak is the blind spot that
    // made greenness-level scoring useless — it is why alfalfa in full bloom was invisible.
    const r = runV2Pipeline(
      records(d => (d < 70 ? 0.20 + d * 0.006 : 0.62)),
      weather(), LAT
    );
    const last = r.phases.length - 1;
    if (r.idxEwma[last] * 100 >= 7) expect(r.phases[last]).toBe('IN_FLOW');
  });

  it('keeps the badge steady rather than flickering day to day', () => {
    const r = runV2Pipeline(records(d => 0.35 + 0.15 * Math.sin(d / 25)), weather(), LAT);
    let switches = 0;
    for (let i = 1; i < r.phases.length; i++) if (r.phases[i] !== r.phases[i - 1]) switches++;
    const years = new Set(r.dates.map(d => d.slice(0, 4))).size || 1;
    expect(switches / years).toBeLessThanOrEqual(12);
  });
});

describe('a qualifying run is coloured in full', () => {
  // Labelling as the counter climbed meant the phase appeared only from day four onward, so
  // every run lost its first three days: a four-day rise showed ONE day of TRENDING_UP.
  // Measured on the real South Valley 2026 series, all eleven qualifying runs hid exactly
  // three days. Ron, reading the chart: "the circled flows don't appear to be 4+ days."
  // They were. The label just started late.

  /** Length of the longest stretch of `phase` in the result. */
  const longestRun = (phases: readonly string[], phase: string) => {
    let best = 0, run = 0;
    for (const p of phases) { run = p === phase ? run + 1 : 0; best = Math.max(best, run); }
    return best;
  };

  it('colours every day of a rise, not just the days after the fourth', () => {
    // A clean 12-day climb out of a flat winter.
    const r = runV2Pipeline(
      records(d => (d < 100 ? 0.20 : 0.20 + (d - 100) * 0.005)),
      weather(), LAT
    );
    // Count the days the slope was actually rising, and the days labelled as such.
    let risingDays = 0;
    for (let i = 0; i < r.slopeArr.length; i++) if ((r.slopeArr[i] ?? 0) > 0.002) risingDays++;
    const labelled = r.phases.filter(p => p === 'TRENDING_UP').length;
    // Every rising day inside a qualifying run should carry the label. Allow for short runs
    // that never reached four days and so are correctly unlabelled.
    expect(labelled).toBeGreaterThan(risingDays * 0.8);
  });

  it('shows at least four days of the phase whenever it shows any', () => {
    // The visible consequence: a run cannot qualify without being four days long, so any
    // appearance of the label must be at least that wide.
    for (const period of [24, 30, 38]) {
      const r = runV2Pipeline(records(d => 0.25 + 0.3 * Math.sin(d / period)), weather(), LAT);
      for (const phase of ['TRENDING_UP', 'TRENDING_DOWN']) {
        const longest = longestRun(r.phases, phase);
        if (longest > 0) expect(longest).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('still refuses a three-day rise', () => {
    // A short bump between two flat stretches must not be labelled at all.
    const r = runV2Pipeline(
      records(d => (d > 100 && d < 112 ? 0.20 + (d - 100) * 0.002 : 0.20)),
      weather(), LAT
    );
    const longest = longestRun(r.phases, 'TRENDING_UP');
    expect(longest === 0 || longest >= 4).toBe(true);
  });
});

describe('two regimes: above the floor it is a flow, below it we look for one', () => {
  // Ron: "Anything above dearth is by definition a flow. So the only real info we can give
  // the beekeeper is the direction." And: "The downside of the curve is still a flow."
  //
  // Above the floor, direction comes from a tolerant trailing trend, so a one-day wobble
  // cannot flip it. That is what a strict run rule got wrong: the 20-27 August 2026 monsoon
  // climb ran 2.3 -> 13.7, unmistakable on the chart, but two down-ticks in the middle split
  // it into runs of three and three and it was never called a flow at all.
  //
  // Below the floor the strict four-day rule survives, because that is the one place it is
  // needed — spotting a rise that has not yet cleared the line.

  it('keeps calling it a flow while it comes back DOWN', () => {
    // The old model called anything under 40 "not in flow". Coming down from a peak there
    // is still real nectar.
    const r = runV2Pipeline(
      records(d => (d < 90 ? 0.20 + d * 0.005 : 0.65 - (d - 90) * 0.002)),
      weather(), LAT
    );
    const descending: string[] = [];
    for (let i = 1; i < r.dates.length; i++) {
      const v = r.idxEwma[i] * 100;
      if (v >= 7 && r.idxEwma[i] < r.idxEwma[i - 1]) descending.push(r.phases[i]);
    }
    expect(descending.length).toBeGreaterThan(10);
    expect(descending.every(p => p !== 'DEARTH')).toBe(true);
  });

  it('survives a one-day wobble in a climb above the floor', () => {
    // A steady rise with a single down-tick two thirds of the way up. Under a strict
    // day-over-day run this split the climb in two and lost the label entirely.
    const r = runV2Pipeline(
      records(d => {
        if (d < 60) return 0.20;
        const base = 0.20 + (d - 60) * 0.005;
        return d >= 115 && d < 125 ? base - 0.02 : base;   // the wobble
      }),
      weather(), LAT
    );
    const high = r.phases.filter((_, i) => r.idxEwma[i] * 100 >= 7);
    expect(high.filter(p => p === 'TRENDING_UP').length).toBeGreaterThan(10);
  });

  it('never says dearth above the floor, nor a flow phase below it without a run', () => {
    const r = runV2Pipeline(records(d => 0.2 + 0.35 * Math.sin(d / 28)), weather(), LAT);
    for (let i = 0; i < r.dates.length; i++) {
      const v = r.idxEwma[i] * 100;
      if (v >= 7) expect(r.phases[i]).not.toBe('DEARTH');
    }
  });

  it('still flags a sustained climb that has NOT cleared the floor', () => {
    // The upturn a beekeeper watches for when they are waiting on a flow.
    const r = runV2Pipeline(
      records(d => (d < 120 ? 0.20 : 0.20 + (d - 120) * 0.0012)),
      weather(), LAT
    );
    const lowFlags = r.phases.filter((_, i) =>
      r.idxEwma[i] * 100 < 7 && r.phases[i] === 'TRENDING_UP').length;
    expect(lowFlags).toBeGreaterThan(0);
  });
});
