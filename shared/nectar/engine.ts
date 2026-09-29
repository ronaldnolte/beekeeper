// Nectar Flow Index engine, V2 — FORMULAS §3. A pure function of satellite records, daily
// weather and latitude. Do not "improve" anything here without re-scoring against golden/.

import { addDays, dayMs, dayOfYear, dayRange, todayUtc } from './dates.js';
import {
  centredQuadraticSlope,
  clamp,
  ewma,
  percentile,
  round3,
  trailingMean,
  trailingSlope,
} from './math.js';

/** Bump whenever a formula changes, so cached results are invalidated (DESIGN-REQUIREMENTS §1). */
export const ENGINE_VERSION = 'v2-2026-09-21';

export interface BandRecord {
  date: string; // YYYY-MM-DD
  ndvi: number;
  evi: number;
  ndwi: number;
}

export interface WeatherDay {
  tmax?: number | null;
  tmin?: number | null;
  dew?: number | null;
}

export type Phase = 'DEARTH' | 'TRENDING_UP' | 'IN_FLOW' | 'TRENDING_DOWN';

export interface EngineOptions {
  /** Last day of the timeline (review mode, fixtures). Default: today (UTC). */
  windowEnd?: string;
  /** Tester override for the EWMA smoothing factor (default 0.18). */
  alpha?: number;
  /** Tester override for the rate lag in days (default 24). */
  rateLag?: number;
  /** Clock for "today"; only used when windowEnd is absent. */
  now?: number;
}

export interface EngineResult {
  dates: string[];
  greenness: number[];
  vigor: number[];
  moisture: number[];
  warmth: number[];
  gate: number[];
  fallTerm: number[];
  rateNorm: number[];
  raw: number[];
  /** Smoothed index, full precision. */
  idx: number[];
  slope: number[];
  phases: Phase[];
}

// Parameters (FORMULAS §3.17).
const ALPHA = 0.18;
const RATE_LAG = 24;
const FUSE_LO = 0.6;
const FUSE_HI = 0.9;
const FALL_WEIGHT = 0.7;
const FALL_WIDTH = 26;
const DEW_LO = 45;
const DEW_HI = 55;
const DEW_WINDOW = 18;
const WARM_LO = 38;
const WARM_HI = 58;
const WARM_WINDOW = 14;
const GDD_BASE = 50;
const GDD_WINDOW = 30;
const GDD_FULL = 200;
const DEFAULT_TEMP = 50;
const DEARTH_FLOOR = 0.07;
const EPS = 0.002;
const RUN_LENGTH = 4;

export const fallCentre = (lat: number) => clamp(Math.round(266 - 1.6 * (lat - 35)), 228, 286);

/** §3.2: per-band daily values — linear interpolation between records, held at the ends. */
function interpolate(records: BandRecord[], dates: string[], band: 'ndvi' | 'evi' | 'ndwi'): number[] {
  const times = records.map(r => dayMs(r.date));
  const out: number[] = [];
  let a = -1; // last record index with date ≤ t
  for (const d of dates) {
    const t = dayMs(d);
    while (a + 1 < records.length && times[a + 1] <= t) a++;
    if (a < 0) out.push(records[0][band]);
    else if (a === records.length - 1) out.push(records[a][band]);
    else {
      const f = (t - times[a]) / (times[a + 1] - times[a]);
      out.push(records[a][band] + (records[a + 1][band] - records[a][band]) * f);
    }
  }
  return out;
}

/** Missing day → previous day's value; first day → 50 °F. */
function forwardFill(values: number[]): number[] {
  const out: number[] = [];
  let prev = DEFAULT_TEMP;
  for (const v of values) {
    if (Number.isFinite(v)) prev = v;
    out.push(prev);
  }
  return out;
}

export function runEngine(
  inputRecords: readonly BandRecord[],
  weather: Readonly<Record<string, WeatherDay>>,
  lat: number,
  opts: EngineOptions = {},
): EngineResult | null {
  const records = [...inputRecords].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  if (records.length === 0) return null;
  const alpha = opts.alpha ?? ALPHA;
  const lag = opts.rateLag ?? RATE_LAG;

  // §3.1 timeline
  // end = min(max(lastRecordDate, cap), cap), which is always the cap: the series runs past the
  // last scene to the cap by forward fill, so the smoother carries to today.
  const cap = opts.windowEnd ?? todayUtc(opts.now);
  const dates = dayRange(records[0].date, cap);
  const N = dates.length;
  if (N === 0) return null;

  // §3.2–3.3 bands and greenness
  const ndvi = interpolate(records, dates, 'ndvi');
  const evi = interpolate(records, dates, 'evi');
  const ndwi = interpolate(records, dates, 'ndwi');
  const G = ndvi.map((n, i) => {
    const w = clamp((n - FUSE_LO) / (FUSE_HI - FUSE_LO), 0, 1);
    return (1 - w) * n + w * evi[i];
  });

  // §3.4 vigor (display only)
  const vBase = percentile(G, 0.05);
  const vRange = Math.max(0.05, percentile(G, 0.95) - vBase);
  const vigor = G.map(g => clamp((g - vBase) / vRange, 0, 1));

  // §3.5 moisture
  const mLo = percentile(ndwi, 0.1);
  const mRange = Math.max(0.05, percentile(ndwi, 0.9) - mLo);
  const moist = ndwi.map(v => 0.7 + 0.3 * clamp((v - mLo) / mRange, 0, 1));

  // §3.6 rate core
  const gS = ewma(G, alpha);
  const rate = gS.map((v, i) => (i >= lag ? v - gS[i - lag] : 0));
  const pos = rate.map(r => Math.max(0, r));
  const peak = Math.max(0.02, percentile(pos, 0.95));
  const rateNorm = pos.map(p => clamp(p / peak, 0, 1));

  // Weather series
  const wx = dates.map(d => weather[d]);
  const num = (v: number | null | undefined) => (typeof v === 'number' ? v : NaN);
  const T = forwardFill(wx.map(w => (w ? (num(w.tmax) + num(w.tmin)) / 2 : NaN)));
  const dew = forwardFill(wx.map(w => (w ? num(w.dew) : NaN)));

  // §3.7 autumn bloom term
  const centre = fallCentre(lat);
  const dpS = trailingMean(dew, DEW_WINDOW);
  const fallTerm = dates.map((d, i) => {
    const photo = Math.exp(-(((dayOfYear(d) - centre) / FALL_WIDTH) ** 2));
    const dp = Number.isFinite(dpS[i]) ? dpS[i] : 50;
    const wet = clamp((dp - DEW_LO) / (DEW_HI - DEW_LO), 0, 1);
    const rateMag = clamp(Math.abs(rate[i]) / peak, 0, 1);
    return photo * wet * (1 - rateMag);
  });
  const I1 = rateNorm.map((r, i) => clamp(r + FALL_WEIGHT * fallTerm[i], 0, 1));

  // §3.8 warmth, §3.9 recent-heat gate
  const Ts = trailingMean(T, WARM_WINDOW);
  const warmth = Ts.map(t => clamp((t - WARM_LO) / (WARM_HI - WARM_LO), 0, 1));
  const gdd = T.map(t => Math.max(0, t - GDD_BASE));
  const gate = gdd.map((_, i) => {
    let s = 0;
    for (let j = Math.max(0, i - GDD_WINDOW + 1); j <= i; j++) s += gdd[j];
    return clamp(s / GDD_FULL, 0, 1);
  });

  // §3.10 raw and smoothed index (gate applied again after smoothing)
  const raw = I1.map((v, i) => v * warmth[i] * gate[i] * moist[i]);
  const idx = ewma(raw, alpha).map((v, i) => v * gate[i]);

  // §3.11 slope: centred quadratic, straight line over the last 5 days
  const slope = idx.map((_, i) => (i >= N - 5 ? trailingSlope(idx, i, 11) : centredQuadraticSlope(idx, i, 5)));

  // §3.12 phases
  const phases: Phase[] = idx.map((v, i) => {
    if (v < DEARTH_FLOOR) return 'DEARTH';
    const tr = trailingSlope(idx, i, 5);
    return tr > EPS ? 'TRENDING_UP' : tr < -EPS ? 'TRENDING_DOWN' : 'IN_FLOW';
  });
  let runStart = -1;
  for (let i = 1; i <= N; i++) {
    const rising = i < N && idx[i] - idx[i - 1] > EPS;
    if (rising && runStart < 0) runStart = i;
    if (!rising && runStart >= 0) {
      if (i - runStart >= RUN_LENGTH) {
        for (let j = runStart; j < i; j++) {
          if (idx[j] < DEARTH_FLOOR && Math.round(100 * idx[j]) !== 0) phases[j] = 'TRENDING_UP';
        }
      }
      runStart = -1;
    }
  }

  return { dates, greenness: G, vigor, moisture: moist, warmth, gate, fallTerm, rateNorm, raw, idx, slope, phases };
}

// ---- API-shaped outputs (§3.13) ----

export const STATUS: Record<Phase, string> = {
  DEARTH: 'Dearth',
  TRENDING_UP: 'Trending Up',
  IN_FLOW: 'In Flow',
  TRENDING_DOWN: 'Trending Down',
};

export function trendDirection(slope: number): 'rising' | 'falling' | 'flat' {
  return slope > EPS ? 'rising' : slope < -EPS ? 'falling' : 'flat';
}

export function summarise(r: EngineResult) {
  const i = r.dates.length - 1;
  const phase = r.phases[i];
  return {
    nfi: Math.round(100 * r.idx[i]),
    phase,
    status: STATUS[phase],
    trend_direction: trendDirection(r.slope[i]),
    slope: r.slope[i],
    v2: {
      greenness: round3(r.greenness[i]),
      vigor: round3(r.vigor[i]),
      moisture: round3(r.moisture[i]),
      warmth: round3(r.warmth[i]),
      fall_term: round3(r.fallTerm[i]),
      rate_norm: round3(r.rateNorm[i]),
    },
    full_history: r.dates.map((date, k) => ({
      date,
      forage_index_smoothed: round3(r.idx[k]),
      phase: r.phases[k],
    })),
  };
}

// ---- §3.14 satellite timing ----

/** Typical days between passes: median of the last few gaps, clamped 2–10. */
function passStep(passDates: readonly string[]): number | null {
  if (passDates.length < 4) return null;
  const recent = passDates.slice(-8);
  const gaps: number[] = [];
  for (let k = 1; k < recent.length; k++) {
    const g = Math.round((dayMs(recent[k]) - dayMs(recent[k - 1])) / 86_400_000);
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return clamp(gaps[Math.floor(gaps.length / 2)], 2, 10);
}

export function nextPass(passDates: readonly string[]): string | null {
  const step = passStep(passDates);
  return step == null ? null : addDays(passDates[passDates.length - 1], step);
}

/**
 * Deliberate change #15 (Ron, 2026-09-27 fix-later list): passes reach the catalogue hours to
 * days late, so the projection can land on today or earlier. Roll it forward by the pass
 * interval until it is after `today` ("YYYY-MM-DD", UTC). Response shape unchanged.
 */
export function upcomingPass(passDates: readonly string[], today: string): string | null {
  const step = passStep(passDates);
  let next = nextPass(passDates);
  if (step == null || next == null) return next;
  while (next <= today) next = addDays(next, step);
  return next;
}
