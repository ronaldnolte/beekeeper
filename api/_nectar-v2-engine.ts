// Pure V2 nectar-flow pipeline. No I/O — takes bands + weather, returns computed series.
// Algorithm: Sentinel-2 NDVI/EVI/NDWI → greenness fusion → robust percentile baseline →
// rate-of-change core (greening velocity) → universal fall-bloom term (photoperiod × dewpoint)
// → dormancy gate (temperature) × NDWI moisture modifier → EWMA live smooth →
// phase classification (incl. IN_FLOW plateau) with dwell hysteresis.
import type { MultiBandRecord } from './_bands-fetcher.js';

/**
 * Four phases, and ONE level threshold. TRANSITION and the chart's PEAK band are gone:
 * both were arbitrary level bands, and Ron — "setting arbitrary limits is likely going to
 * never work in all places."
 *
 * ABOVE the dearth line the landscape IS in flow, and the only news is which way it is
 * going. "The downside of the curve is still a flow."
 *
 *   trending up   -> TRENDING_UP
 *   level         -> IN_FLOW        (a steady flow shows no slope; a plateau is not weak)
 *   trending down -> TRENDING_DOWN
 *
 * BELOW it the question is different — is one starting? A sustained four-day climb is
 * called out even under the floor, because that upturn is what a beekeeper watches for
 * while waiting on a flow. Otherwise DEARTH.
 */
export type Phase = 'DEARTH' | 'TRENDING_UP' | 'IN_FLOW' | 'TRENDING_DOWN';

export interface WeatherDay {
  tmax: number;
  tmin: number;
  dew: number | null;
}

export interface V2LatestValues {
  greenness: number;
  vigor: number;
  moisture: number;
  warmth: number;
  fall_term: number;
  rate_norm: number;
}

export interface V2HistoryPoint {
  date: string;
  forage_index_smoothed: number;
  phase: Phase;
}

export interface V2EngineResult {
  dates: string[];
  idxEwma: number[];
  phases: Phase[];
  slopeArr: number[];
  latest: V2LatestValues;
  history: V2HistoryPoint[];
}

interface V2Params {
  baselinePct: number; ceilingPct: number;
  fuseLo: number; fuseHi: number;
  moistFloor: number;
  alpha: number; sgHalf: number;
  dearth: number;
  riseThr: number; runDays: number;
  dormLo: number; dormHi: number; tWin: number;
  rateLag: number;
  wFall: number; dpLo: number; dpHi: number; fallWidth: number;
}

const DEFAULTS: V2Params = {
  baselinePct: 0.05, ceilingPct: 0.95,
  fuseLo: 0.6, fuseHi: 0.9,
  moistFloor: 0.7,
  alpha: 0.18, sgHalf: 5,
  // Dearth floor at 7, not 15. Ron: "In Albuquerque right now an Index of any other
  // than 0 seems good." A high floor in an arid landscape calls a real trickle nothing.
  dearth: 0.07, riseThr: 0.002, runDays: 4,
  dormLo: 38, dormHi: 58, tWin: 14,
  rateLag: 24,
  wFall: 0.7, dpLo: 45, dpHi: 55, fallWidth: 26,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const DAY_MS = 86_400_000;

function dayOfYear(dateStr: string): number {
  const dt = new Date(dateStr + 'T00:00');
  return Math.floor((dt.getTime() - new Date(dt.getFullYear(), 0, 0).getTime()) / DAY_MS);
}

// Photoperiod-proxy center for fall flows: shifts earlier with latitude (~Sep 23 at 35°N).
function fallCenter(lat: number): number {
  return clamp(Math.round(266 - (lat - 35) * 1.6), 228, 286);
}

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const i = p * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function ewmaArr(arr: number[], alpha: number): number[] {
  const out: number[] = new Array(arr.length);
  let s: number | null = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!isFinite(v)) { out[i] = s ?? 0; continue; }
    s = s === null ? v : alpha * v + (1 - alpha) * s;
    out[i] = s;
  }
  return out;
}

function trailingMean(arr: (number | null)[], win: number): (number | null)[] {
  return arr.map((_, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - win + 1); k <= i; k++) {
      if (arr[k] != null) { s += arr[k]!; n++; }
    }
    return n ? s / n : null;
  });
}

/**
 * One-sided linear slope over a trailing window, for the live end of the series.
 *
 * localPoly below fits a PARABOLA over a centred window. That is well behaved in the
 * interior, where there are points on both sides holding it down. For the final `sgHalf`
 * days there are none ahead, so the parabola is anchored on one side only and is free to
 * keep bending past the last point — and the slope is read exactly at that unanchored edge.
 * It answers "where would this be heading if it kept curving", not "what did it just do".
 *
 * Measured at Murfreesboro on 2026-08-18: slope -0.18062, larger in magnitude than the
 * maximum (0.13434) anywhere in 3.6 years of fully supported fits, and sign-flipped from the
 * day before. On a gently flattening curve the effect is smaller but the same shape — the
 * parabola reports a downturn on a series that is still rising.
 *
 * A straight line has no curvature to run away with. Two coefficients rather than three, so
 * it can only answer "on average, which way over the last N days", which is the honest
 * question at the edge. The final value drives trend_direction and the phase badge, so it
 * gets the stable estimator rather than the sharper one.
 */
export function trailingSlope(arr: number[], i: number, win: number): number {
  const lo = Math.max(0, i - win + 1);
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let j = lo; j <= i; j++) {
    const y = arr[j];
    if (!isFinite(y)) continue;
    const x = j - i;
    n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  if (n < 3) return 0;
  const den = n * sxx - sx * sx;
  return Math.abs(den) < 1e-12 ? 0 : (n * sxy - sx * sy) / den;
}

function localPoly(arr: number[], half: number): { smooth: number[]; slope: number[] } {
  const N = arr.length;
  const smooth: number[] = new Array(N).fill(0);
  const slope: number[]  = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(N - 1, i + half); j++) {
      const y = arr[j];
      if (!isFinite(y)) continue;
      const x = j - i, x2 = x * x;
      S0 += 1; S1 += x; S2 += x2; S3 += x2 * x; S4 += x2 * x2;
      T0 += y; T1 += x * y; T2 += x2 * y;
      n++;
    }
    if (n < 3) continue;
    const A = [[S0, S1, S2, T0], [S1, S2, S3, T1], [S2, S3, S4, T2]];
    let singular = false;
    for (let c = 0; c < 3; c++) {
      let piv = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) { singular = true; break; }
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
      }
    }
    if (singular) continue;
    smooth[i] = A[0][3] / A[0][0];
    slope[i]  = A[1][3] / A[1][1];
  }
  return { smooth, slope };
}

function interpBand(recs: { t: number; v: number }[], dailyTs: number[]): number[] {
  const sorted = [...recs].sort((a, b) => a.t - b.t);
  return dailyTs.map(t => {
    let j = 0;
    while (j < sorted.length - 1 && sorted[j + 1].t <= t) j++;
    const a = sorted[j], b = sorted[Math.min(j + 1, sorted.length - 1)];
    if (t <= a.t) return a.v;
    if (t >= b.t) return b.v;
    return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t);
  });
}

export function runV2Pipeline(
  records: MultiBandRecord[],
  weatherMap: Record<string, WeatherDay>,
  lat: number,
  params: Partial<V2Params> = {}
): V2EngineResult {
  const P: V2Params = { ...DEFAULTS, ...params };

  const empty: V2EngineResult = {
    dates: [], idxEwma: [], phases: [], slopeArr: [],
    latest: { greenness: 0, vigor: 0, moisture: 0, warmth: 0, fall_term: 0, rate_norm: 0 },
    history: [],
  };
  if (records.length === 0) return empty;

  // Daily timeline from first observed scene to today.
  // Extends past the last satellite observation so EWMA carries forward to the current date
  // (interpBand forward-fills the last known value for days with no new scene).
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const startT = new Date(sorted[0].date + 'T00:00').getTime();
  const lastObsT = new Date(sorted[sorted.length - 1].date + 'T00:00').getTime();
  const todayT  = new Date(new Date().toISOString().slice(0, 10) + 'T00:00').getTime();
  const endT    = Math.max(lastObsT, todayT);
  const dailyTs: number[] = [];
  for (let t = startT; t <= endT; t += DAY_MS) dailyTs.push(t);
  const N = dailyTs.length;
  const dates = dailyTs.map(t => new Date(t).toISOString().slice(0, 10));

  const mkRecs = (key: keyof MultiBandRecord) =>
    sorted.map(r => ({ t: new Date(r.date + 'T00:00').getTime(), v: r[key] as number }));
  const ndvi = interpBand(mkRecs('ndvi'), dailyTs);
  const evi  = interpBand(mkRecs('evi'),  dailyTs);
  const ndwi = interpBand(mkRecs('ndwi'), dailyTs);

  // Greenness: NDVI anchors; blend in EVI as NDVI saturates in dense canopy
  const greenness = ndvi.map((nd, i) => {
    const w = clamp((nd - P.fuseLo) / (P.fuseHi - P.fuseLo), 0, 1);
    return (1 - w) * nd + w * evi[i];
  });

  // Robust 5th/95th-pct baseline — avoids contamination from cloud/snow/water lows
  const baseline = pct(greenness, P.baselinePct);
  const ceiling  = pct(greenness, P.ceilingPct);
  const range    = Math.max(0.05, ceiling - baseline);
  const vigor    = greenness.map(g => clamp((g - baseline) / range, 0, 1));

  // NDWI moisture modifier — per-location percentile normalization (location-agnostic)
  const ndwiLo    = pct(ndwi, 0.10), ndwiHi = pct(ndwi, 0.90);
  const ndwiRange = Math.max(0.05, ndwiHi - ndwiLo);
  const moist     = ndwi.map(w =>
    P.moistFloor + (1 - P.moistFloor) * clamp((w - ndwiLo) / ndwiRange, 0, 1)
  );

  // Rate core: greening velocity over rateLag days — surfaces dearths greenness-level misses
  const gS      = ewmaArr(greenness, P.alpha);
  const rate    = gS.map((v, i) => i >= P.rateLag ? v - gS[i - P.rateLag] : 0);
  const posRate = rate.map(r => Math.max(0, r));
  const ratePeak = Math.max(0.02, pct(posRate, 0.95));
  const rateNorm = posRate.map(r => clamp(r / ratePeak, 0, 1));

  // Fall-bloom term: universal photoperiod-proxy × dewpoint moisture gap-fill
  // Fires only where NDVI-rate is flat (1 − |rateMag|) — adds fall flows greenness can't see
  const center = fallCenter(lat);
  const dpRaw: (number | null)[] = dates.map(d => weatherMap[d]?.dew ?? null);
  for (let i = 0; i < N; i++) if (dpRaw[i] == null) dpRaw[i] = i > 0 ? dpRaw[i - 1] : 50;
  const dpSust = trailingMean(dpRaw, 18);
  const fallTerm = dates.map((d, i) => {
    const photo    = Math.exp(-Math.pow((dayOfYear(d) - center) / P.fallWidth, 2));
    const moisture = clamp(((dpSust[i] ?? 50) - P.dpLo) / (P.dpHi - P.dpLo), 0, 1);
    const rateMag  = clamp(Math.abs(rate[i]) / ratePeak, 0, 1);
    return photo * moisture * (1 - rateMag);
  });
  const indexWithFall = rateNorm.map((v, i) => clamp(v + P.wFall * fallTerm[i], 0, 1));

  // Warmth weighting: 14-day mean temperature ramp scaled 38-58F. A gentle graded
  // weight (not a hard gate) — it still vetoes deep cold (winter approx 0) so cold-season
  // green-ups don't read as flows, but the wide band lets the early-spring "toe" through
  // gradually instead of clipping it flat and forcing a vertical launch when temps cross.
  const tmeanRaw: (number | null)[] = dates.map(d => {
    const w = weatherMap[d];
    return w ? (w.tmax + w.tmin) / 2 : null;
  });
  for (let i = 0; i < N; i++) if (tmeanRaw[i] == null) tmeanRaw[i] = i > 0 ? tmeanRaw[i - 1] : 50;
  const tSm    = trailingMean(tmeanRaw, P.tWin);
  const warmth = tSm.map(t => t == null ? 1 : clamp((t - P.dormLo) / (P.dormHi - P.dormLo), 0, 1));

  // Moisture applied as a gentle multiplier (floor 0.7 caps the penalty at -30% in
  // bone-dry conditions). NDWI leads NDVI, so this nudges the index earlier/later
  // than greenness alone would.
  const indexRaw = indexWithFall.map((v, i) => v * warmth[i] * moist[i]);

  // EWMA for live smoothed value; local-poly for slope (SG-equivalent, uses future pts for history)
  const idxEwma         = ewmaArr(indexRaw, P.alpha);
  // The slope must describe the series the beekeeper is LOOKING AT.
  //
  // It was computed from indexRaw while the chart, the phase test and the NFI all use
  // idxEwma. The smoother lags, so when the raw series turned up the smoothed one was still
  // coming down, and the badge described a line that was not on screen. Measured at South
  // Valley: 27-30 June 2026 the index fell 3.53 -> 0.72 while the slope read +0.005 to
  // +0.015 and the phase said TRENDING_UP for five straight days.
  const { slope: slopeArr } = localPoly(idxEwma, P.sgHalf);
  // The last sgHalf days have no future points, so the centred fit extrapolates there.
  // Replace those with the one-sided estimator (see trailingSlope).
  for (let i = Math.max(0, N - P.sgHalf); i < N; i++) {
    slopeArr[i] = trailingSlope(idxEwma, i, 2 * P.sgHalf + 1);
  }

  // Phase classification, rewritten 2026-08-28 to Ron's specification.
  //
  //   1. four consecutive days rising  -> TRENDING_UP
  //   2. four consecutive days falling -> TRENDING_DOWN
  //   3. otherwise, below the dearth floor -> DEARTH
  //   4. otherwise -> IN_FLOW
  //
  // DIRECTION decides the phase; only one level threshold survives. The old scheme had
  // three separate level bands (dearth 15, enter 40) plus a TRANSITION phase, and the chart
  // drew four more that disagreed with all of them — dearth to 20, flow from 30, peak from
  // 75. Three sets of numbers on one screen, none matching. Ron: "setting arbitrary limits
  // is likely going to never work in all places."
  //
  // Four days rather than three because a shorter run picks up noise: 1-3 July 2026 at
  // South Valley scaled up for three days and died on the fourth, which is not something to
  // put in front of a beekeeper as advice.
  //
  // The run counter IS the hysteresis, so the separate dwell is gone. A run only ends when
  // the slope stops agreeing with it, which is a stronger and more legible guarantee than a
  // candidate counter that could be reset by a third phase appearing mid-transition — the
  // defect that stranded the badge on DEARTH while the index climbed past 18.
  //
  // NOTE: a rising run earns TRENDING_UP at ANY level, including below the dearth floor.
  // That is rule 2 as written ("any 4 days with positive slope"), and it is deliberate: a
  // sustained climb is information even when the absolute number is small.
  // Two passes, because a qualifying run must colour the WHOLE rise, not just its tail.
  //
  // Labelling as the counter climbed meant the phase only appeared on day four onward, so
  // every run lost its first three days: a four-day rise showed one day of TRENDING_UP, a
  // five-day rise showed two. On the real South Valley 2026 series that hid exactly three
  // days from all eleven qualifying runs. Ron, reading the chart: "the circled flows don't
  // appear to be 4+ days." They were — the label just started late.
  //
  // Pass one finds the runs. Pass two labels a run in full once it is long enough.
  // Above the dearth line the landscape IS in flow, and the only news is which way it is
  // going. Below it, the question is whether one is starting. Two different questions, so
  // two different tests — Ron: "Anything above dearth is by definition a flow. So the only
  // real info we can give the beekeeper is the direction."
  //
  // That split is what makes the run length stop mattering where it was causing trouble. A
  // strict four-day rule broke on a single wiggle: the 20-27 August 2026 monsoon climb went
  // 2.3 -> 13.7, unmistakable on the chart, but two down-ticks in the middle split it into
  // runs of three and three and it was never labelled a flow at all. Above the floor the
  // run length is now irrelevant; it only governs the one case it is needed for.
  const phases: Phase[] = new Array(N);

  // TREND, for use above the floor. A trailing linear fit over a week, so it is causal — no
  // peeking at days that have not happened — and a one-day wobble cannot flip it. A centred
  // fit could see the future: on 29 June 2026 it reported the trend as upward while the
  // index was visibly falling, 0.88 -> 0.72 -> 0.59, because it could already see 2-4 July.
  // Five days, which is four intervals — the same four-day span the run rule uses.
  // Seven was too long: after the steep June 2026 peak the climb still dominated the fit,
  // so the badge read Trending Up on 4 June with the index visibly down three days running,
  // 68.9 -> 59.0. Measured, a 5-day window turns three days after a peak; 7 takes four, 9
  // takes five. Short enough to turn promptly, long enough that a one-day wobble cannot
  // flip it.
  const TREND_WINDOW = 5;
  const trend = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) {
    const sl = trailingSlope(idxEwma, i, TREND_WINDOW);
    trend[i] = sl > P.riseThr ? 1 : sl < -P.riseThr ? -1 : 0;
  }

  // DAY-OVER-DAY, for spotting a rise that has not yet cleared the floor. Strict here on
  // purpose: below the floor the numbers are tiny and a fitted trend would call almost any
  // drift a flow. "Four days with positive slope", read off a chart, means four days each
  // higher than the one before.
  const dayOverDay = new Array<number>(N).fill(0);
  for (let i = 1; i < N; i++) {
    const change = idxEwma[i] - idxEwma[i - 1];
    dayOverDay[i] = change > P.riseThr ? 1 : change < -P.riseThr ? -1 : 0;
  }

  // Above the floor: a flow, named by its direction. Below: a dearth until a run says
  // otherwise.
  for (let i = 0; i < N; i++) {
    if (idxEwma[i] >= P.dearth) {
      phases[i] = trend[i] > 0 ? 'TRENDING_UP' : trend[i] < 0 ? 'TRENDING_DOWN' : 'IN_FLOW';
    } else {
      phases[i] = 'DEARTH';
    }
  }

  // Below the floor, a sustained climb still gets called out — the upturn a beekeeper
  // watches for when they are waiting on a flow. A qualifying run is coloured in FULL, not
  // just from its fourth day: labelling as the counter climbed hid the first three days of
  // every run, so a four-day rise showed one day of colour.
  let i = 0;
  while (i < N) {
    if (dayOverDay[i] !== 1) { i++; continue; }
    let j = i;
    while (j + 1 < N && dayOverDay[j + 1] === 1) j++;
    if (j - i + 1 >= P.runDays) {
      for (let k = i; k <= j; k++) {
        if (idxEwma[k] >= P.dearth) continue;          // already labelled by trend
        // A displayed NFI of zero is never a flow, whatever the slope is doing. Ron: "I
        // guess I am assuming a NFI of 0 will never be labeled as a Flow." Measured before
        // this guard: 45 days across three years carried a flow phase while the number on
        // screen read 0 — a run can clear the threshold on rounding alone and go nowhere.
        if (Math.round(idxEwma[k] * 100) === 0) continue;
        phases[k] = 'TRENDING_UP';
      }
    }
    i = j + 1;
  }

  const li = N - 1;
  const latest: V2LatestValues = {
    greenness: Math.round(greenness[li] * 1000) / 1000,
    vigor:     Math.round(vigor[li]     * 1000) / 1000,
    moisture:  Math.round(moist[li]     * 1000) / 1000,
    warmth:    Math.round(warmth[li]    * 1000) / 1000,
    fall_term: Math.round(fallTerm[li]  * 1000) / 1000,
    rate_norm: Math.round(rateNorm[li]  * 1000) / 1000,
  };

  const history: V2HistoryPoint[] = dates.map((d, i) => ({
    date: d,
    forage_index_smoothed: Math.round(idxEwma[i] * 1000) / 1000,
    phase: phases[i],
  }));

  return { dates, idxEwma, phases, slopeArr, latest, history };
}
