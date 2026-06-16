// Pure V2 nectar-flow pipeline. No I/O — takes bands + weather, returns computed series.
// Algorithm: Sentinel-2 NDVI/EVI/NDWI → greenness fusion → robust percentile baseline →
// rate-of-change core (greening velocity) → universal fall-bloom term (photoperiod × dewpoint)
// → dormancy gate (temperature) → EWMA live smooth → phase classification with dwell hysteresis.
import type { MultiBandRecord } from './bands-fetcher.js';

export type Phase = 'DEARTH' | 'FLOW_STARTING' | 'IN_FLOW' | 'FLOW_ENDING' | 'TRANSITION';

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
  ndvi: number;
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
  enter: number; exit: number; dearth: number;
  riseThr: number; dwell: number;
  dormLo: number; dormHi: number; tWin: number;
  rateLag: number;
  wFall: number; dpLo: number; dpHi: number; fallWidth: number;
}

const DEFAULTS: V2Params = {
  baselinePct: 0.05, ceilingPct: 0.95,
  fuseLo: 0.6, fuseHi: 0.9,
  moistFloor: 0.7,
  alpha: 0.18, sgHalf: 5,
  enter: 0.40, exit: 0.30, dearth: 0.15, riseThr: 0.012, dwell: 3,
  dormLo: 45, dormHi: 55, tWin: 14,
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
  // rateMag is smoothed over a few days first: a single noisy/cloud-affected satellite scene
  // can otherwise punch rate toward zero for one day and fully open this gate, producing a
  // sharp single-day spike in the fall window that has nothing to do with real forage.
  const center = fallCenter(lat);
  const dpRaw: (number | null)[] = dates.map(d => weatherMap[d]?.dew ?? null);
  for (let i = 0; i < N; i++) if (dpRaw[i] == null) dpRaw[i] = i > 0 ? dpRaw[i - 1] : 50;
  const dpSust = trailingMean(dpRaw, 18);
  const rateMagRaw    = rate.map(r => clamp(Math.abs(r) / ratePeak, 0, 1));
  const rateMagSmooth = trailingMean(rateMagRaw, 5);
  const fallTerm = dates.map((d, i) => {
    const photo    = Math.exp(-Math.pow((dayOfYear(d) - center) / P.fallWidth, 2));
    const moisture = clamp(((dpSust[i] ?? 50) - P.dpLo) / (P.dpHi - P.dpLo), 0, 1);
    const rateMag  = rateMagSmooth[i] ?? 0;
    return photo * moisture * (1 - rateMag);
  });
  const indexWithFall = rateNorm.map((v, i) => clamp(v + P.wFall * fallTerm[i], 0, 1));

  // Dormancy gate: 14-day mean temperature ramp — gives winter≈0, climate-appropriate
  const tmeanRaw: (number | null)[] = dates.map(d => {
    const w = weatherMap[d];
    return w ? (w.tmax + w.tmin) / 2 : null;
  });
  for (let i = 0; i < N; i++) if (tmeanRaw[i] == null) tmeanRaw[i] = i > 0 ? tmeanRaw[i - 1] : 50;
  const tSm    = trailingMean(tmeanRaw, P.tWin);
  const warmth = tSm.map(t => t == null ? 1 : clamp((t - P.dormLo) / (P.dormHi - P.dormLo), 0, 1));

  const indexRaw = indexWithFall.map((v, i) => v * warmth[i]);

  // EWMA for live smoothed value; local-poly for slope (SG-equivalent, uses future pts for history)
  const idxEwma         = ewmaArr(indexRaw, P.alpha);
  const { slope: slopeArr } = localPoly(indexRaw, P.sgHalf);

  // Phase classification: intuitive (low=dearth, rising=building, high=peak, falling=winding down)
  // with dwell hysteresis to prevent daily flipping
  const instPhase = idxEwma.map((v, i): Phase => {
    const sl = slopeArr[i] ?? 0;
    // Strong slope = direction-named phase
    if (sl >  P.riseThr)  return 'FLOW_STARTING';
    if (sl < -P.riseThr)  return 'FLOW_ENDING';
    // Gentle or zero slope = transition everywhere, dearth only at the floor
    // (peak plateau has near-zero slope so it correctly shows as transition)
    return v < P.dearth ? 'DEARTH' : 'TRANSITION';
  });
  const phases: Phase[] = new Array(N);
  let cur: Phase = 'TRANSITION', cand: Phase | null = null, candN = 0;
  for (let i = 0; i < N; i++) {
    if (instPhase[i] === cur) { cand = null; candN = 0; }
    else if (instPhase[i] === cand) {
      if (++candN >= P.dwell) { cur = cand!; cand = null; candN = 0; }
    } else { cand = instPhase[i]; candN = 1; }
    phases[i] = cur;
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
    ndvi: Math.round(ndvi[i] * 1000) / 1000,
  }));

  return { dates, idxEwma, phases, slopeArr, latest, history };
}
