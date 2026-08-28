import { describe, it, expect } from '@jest/globals';
import { runV2Pipeline, trailingSlope, WeatherDay } from '../nectar-v2-engine';
import type { MultiBandRecord } from '../bands-fetcher';

// Two bugs in the phase badge, both measured on production data.
//
// 1. A dead yard could be labelled a flow. The slope tests ran before the dearth floor, so a
//    trivial slope on a near-zero index promoted it to FLOW_STARTING or FLOW_ENDING, and the
//    dwell hysteresis then held that label indefinitely. Measured: FLOW_STARTING at index 2
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

describe('the dearth floor is checked before the slope', () => {
  it('does not leave a flow label standing on a near-zero index', () => {
    // The shape that produced FLOW_STARTING at index 2. A real spring green-up first, so
    // the rate normalisation has a genuine peak to scale against — on a flat series the
    // end-drift IS the biggest change in the record and normalises to a large number, which
    // is the percentile normalisation working correctly on a degenerate fixture.
    const r = runV2Pipeline(
      records(d => {
        if (d < 60) return 0.20 + d * 0.006;                  // green-up
        if (d < 110) return 0.56 - (d - 60) * 0.007;          // decline to bare
        return 0.21 + (d > 190 ? (d - 190) * 0.0004 : 0);     // dead, with a late wobble
      }),
      weather(), LAT
    );
    const last = r.idxEwma.length - 1;
    expect(r.idxEwma[last] * 100).toBeLessThan(15);
    expect(r.phases[last]).toBe('DEARTH');
  });

  it('cannot hold a flow phase below the floor for longer than the dwell', () => {
    // Below the floor the instantaneous phase is always DEARTH, so the hysteresis can only
    // delay the label by `dwell` days (3) — it can no longer hold it indefinitely, which is
    // what the old ordering allowed.
    const r = runV2Pipeline(records(d => 0.2 + 0.45 * Math.sin(d / 32)), weather(), LAT);
    let run = 0, worst = 0;
    for (let i = 0; i < r.dates.length; i++) {
      const belowFloor = r.idxEwma[i] * 100 < 15;
      const flowPhase = r.phases[i] === 'FLOW_STARTING' || r.phases[i] === 'FLOW_ENDING'
        || r.phases[i] === 'IN_FLOW';
      run = (belowFloor && flowPhase) ? run + 1 : 0;
      worst = Math.max(worst, run);
    }
    expect(worst).toBeLessThanOrEqual(3);
  });

  it('still reaches the flow phases when the index is genuinely high', () => {
    // The floor must not make IN_FLOW unreachable — that was a previous overcorrection.
    const r = runV2Pipeline(records(d => 0.15 + 0.6 * Math.sin(d / 40)), weather(), LAT);
    const seen = new Set(r.phases);
    expect(seen.has('DEARTH')).toBe(true);
    expect(seen.has('IN_FLOW') || seen.has('FLOW_STARTING')).toBe(true);
  });
});
