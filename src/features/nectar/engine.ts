export interface Apiary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  forage_radius_km: number;
}

export interface DailyEnvironment {
  date: string; // ISO date
  ndvi: number | null;
  ndvi_min: number | null;
  ndvi_max: number | null;
  /** Typical NDVI for this calendar day, averaged over the prior 3 years. */
  typical_ndvi?: number | null;
  bloom_factor: number | null;
  temp_suitability?: number | null;
  rain_suitability?: number | null;
  wind_suitability?: number | null;
}

const clamp01 = (x: number): number => Math.min(1.0, Math.max(0.0, x));

/**
 * Exponential moving average over a series. The newest point carries the most
 * weight (alpha = 2/(span+1); span 7 -> ~25% on the latest day). Nulls hold the
 * previous smoothed value. Seeds on the first valid value.
 */
export function emaSeries(values: (number | null | undefined)[], span: number): (number | null)[] {
  const alpha = 2 / (span + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (const v of values) {
    if (v === null || v === undefined || isNaN(v)) {
      out.push(prev);
      continue;
    }
    prev = prev === null ? v : alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

export interface NectarStatus {
  date: string;
  forage_index_raw: number | null;
  forage_index_smoothed: number | null;
  delta_forage: number | null;
  phase: 'DEARTH' | 'FLOW_STARTING' | 'IN_FLOW' | 'FLOW_ENDING' | 'TRANSITION';
}

export interface NFIBreakdown {
  nfi: number;
  ratio: number;
  layer1Score: number;
  layer1Max: number;
  slope: number;
  phenologyBoost: number;
  status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low';
  transitionAdvice: string;
}

/**
 * Deterministic pipeline to calculate daily nectar flow status for an apiary over time.
 * @param apiary Apiary information
 * @param dailyEnvironmentHistory Daily environmental variables sorted chronologically
 */
export function computeNectarStatus(
  apiary: Apiary,
  dailyEnvironmentHistory: DailyEnvironment[]
): NectarStatus[] {
  // Reference parameters to satisfy unused checks
  void apiary;

  if (!dailyEnvironmentHistory || dailyEnvironmentHistory.length === 0) {
    return [];
  }

  // Ensure chronological sort
  const history = [...dailyEnvironmentHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Each ingredient is smoothed with the SAME span-7 exponential average so the
  // final trend behaves like one, then combined as a WEIGHTED BLEND (not a
  // product). Vigor (measured vegetation) is the trusted, steady signal; bloom
  // is a calendar approximation; weather leads the effect (rain today, nectar
  // tomorrow) so it's only a light nudge.
  const EMA_SPAN = 7;
  const W_VIGOR = 0.70;
  const W_BLOOM = 0.20;
  const W_WEATHER = 0.10;

  const ndviEma = emaSeries(history.map(h => h.ndvi), EMA_SPAN);
  const typicalEma = emaSeries(history.map(h => h.typical_ndvi), EMA_SPAN);

  // Vigor: how the smoothed current greenness compares to the typical (3-year
  // average) greenness for this same calendar day. ratio 1.0 (normal) -> 0.5;
  // ~+50% -> 1.0; ~-50% -> 0.0. Falls back to the site's own min/max range when
  // no typical baseline is available. (NDVI is already exponentially smoothed.)
  const vigorList: (number | null)[] = history.map((item, idx) => {
    const ndvi = ndviEma[idx];
    if (ndvi === null || isNaN(ndvi)) return null;
    const typical = typicalEma[idx];
    if (typical !== null && typical > 0.05) {
      return clamp01(ndvi / typical - 0.5);
    }
    const ndvi_min = item.ndvi_min !== null && item.ndvi_min !== undefined ? clamp01(item.ndvi_min) : 0.0;
    const ndvi_max = item.ndvi_max !== null && item.ndvi_max !== undefined ? clamp01(item.ndvi_max) : 1.0;
    const ndviRange = ndvi_max - ndvi_min;
    return ndviRange > 0.05
      ? clamp01((ndvi - ndvi_min) / ndviRange / 0.6)
      : clamp01((ndvi - 0.2) / 0.4);
  });

  // Smooth bloom and weather the same way as vegetation, so all three ingredients
  // are on equal smoothing footing before blending.
  const bloomEma = emaSeries(
    history.map(h => h.bloom_factor !== null && h.bloom_factor !== undefined ? clamp01(h.bloom_factor) : null),
    EMA_SPAN
  );
  const weatherEma = emaSeries(
    history.map(h => {
      if (h.temp_suitability !== undefined && h.temp_suitability !== null &&
          h.rain_suitability !== undefined && h.rain_suitability !== null &&
          h.wind_suitability !== undefined && h.wind_suitability !== null) {
        return clamp01(clamp01(h.temp_suitability) * clamp01(h.rain_suitability) * clamp01(h.wind_suitability));
      }
      return null;
    }),
    EMA_SPAN
  );

  // 1. Weighted blend of the smoothed ingredients.
  const rawForageList = history.map((item, idx) => {
    const v = vigorList[idx];
    if (v === null) return { date: item.date, forage_raw: null, vigor: null };
    const b = bloomEma[idx] ?? 0;
    const w = weatherEma[idx];
    // If weather isn't available yet, re-normalize across the remaining weights.
    const forage = w === null
      ? clamp01((W_VIGOR * v + W_BLOOM * b) / (W_VIGOR + W_BLOOM))
      : clamp01(W_VIGOR * v + W_BLOOM * b + W_WEATHER * w);
    return { date: item.date, forage_raw: forage, vigor: v };
  });

  // 2. The blended ingredients are already smoothed, so this IS the smoothed
  //    index; the delta is the day-over-day change.
  const computedList = history.map((item, idx) => {
    const smoothed = rawForageList[idx].forage_raw;
    const prevSmoothed = idx > 0 ? rawForageList[idx - 1].forage_raw : null;
    const delta = smoothed !== null && prevSmoothed !== null ? smoothed - prevSmoothed : null;

    return {
      date: item.date,
      forage_index_raw: smoothed,
      forage_index_smoothed: smoothed,
      delta_forage: delta,
      ndvi: item.ndvi
    };
  });

  // Find the peak smoothed value in the last 90 days (representing the current season's high)
  const recentList = computedList.slice(-90);
  const validSmoothed = recentList.map(c => c.forage_index_smoothed).filter(v => v !== null && !isNaN(v)) as number[];
  const maxSmoothed = validSmoothed.length > 0 ? Math.max(...validSmoothed) : 0.20;

  // Dynamic classification thresholds relative to maxSmoothed. The weighted blend
  // runs higher than the old product, so these floors are higher too. PROVISIONAL
  // — calibrate against real locations (e.g. Murfreesboro) before relying on the
  // phase labels.
  const FLOW_ENTER_THRESHOLD = Math.max(0.50, maxSmoothed * 0.75);
  const FLOW_EXIT_THRESHOLD  = Math.max(0.32, maxSmoothed * 0.50);
  const DELTA_UP   = Math.max(0.004, maxSmoothed * 0.03);
  const DELTA_DOWN = Math.min(-0.004, maxSmoothed * -0.03);

  // 3. Second pass: Classify phase for each day using dynamic thresholds
  return computedList.map((item) => {
    let phase: 'DEARTH' | 'FLOW_STARTING' | 'IN_FLOW' | 'FLOW_ENDING' | 'TRANSITION' = 'TRANSITION';
    const smoothed = item.forage_index_smoothed;
    const delta = item.delta_forage;

    if (item.ndvi === undefined || item.ndvi === null || isNaN(item.ndvi)) {
      phase = 'TRANSITION';
    } else if (smoothed === null || smoothed === undefined || delta === null || delta === undefined) {
      phase = 'TRANSITION';
    } else {
      if (smoothed > FLOW_ENTER_THRESHOLD && delta > DELTA_UP) {
        phase = 'FLOW_STARTING';
      } else if (smoothed > FLOW_ENTER_THRESHOLD && delta <= DELTA_UP) {
        phase = 'IN_FLOW';
      } else if (smoothed < FLOW_EXIT_THRESHOLD) {
        phase = 'DEARTH';
      } else if (smoothed >= FLOW_EXIT_THRESHOLD && smoothed <= FLOW_ENTER_THRESHOLD && delta < DELTA_DOWN) {
        phase = 'FLOW_ENDING';
      } else {
        phase = 'TRANSITION';
      }
    }

    return {
      date: item.date,
      forage_index_raw: item.forage_index_raw,
      forage_index_smoothed: smoothed,
      delta_forage: delta,
      phase
    };
  });
}

/**
 * Backward compatibility wrapper to prevent compilation breaks in the client app.
 */
export function calculateNFI(
  currentNDVI: number,
  historicalNDVI: number,
  previousNDVI: number
): NFIBreakdown {
  // Mock Apiary
  const mockApiary: Apiary = {
    id: 'compat',
    name: 'Compatibility Bridge',
    lat: 39,
    lon: -98,
    forage_radius_km: 1.6
  };

  // Mock an 8-day history to get a valid 7-day average and delta today
  const dailyHistory: DailyEnvironment[] = [];
  const baseDate = new Date();
  
  for (let i = 7; i >= 0; i--) {
    const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
    // Let days 0 to 6 have previousNDVI, day 7 (today) has currentNDVI
    const ndviVal = i === 0 ? currentNDVI : previousNDVI;
    dailyHistory.push({
      date: d.toISOString(),
      ndvi: ndviVal,
      ndvi_min: historicalNDVI,
      ndvi_max: 0.85,
      bloom_factor: 1.0,
      temp_suitability: 1.0,
      rain_suitability: 1.0,
      wind_suitability: 1.0
    });
  }

  const results = computeNectarStatus(mockApiary, dailyHistory);
  const latest = results[results.length - 1];

  const nfi = latest.forage_index_smoothed !== null ? Math.round(latest.forage_index_smoothed * 100) : 0;
  const slope = latest.delta_forage !== null ? latest.delta_forage : 0;

  let status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low' = 'Stable Low';
  let transitionAdvice = 'Transition state. Monitor forage levels and colony strength.';

  switch (latest.phase) {
    case 'IN_FLOW':
      status = 'Peak Flow';
      transitionAdvice = 'Peak nectar flow is active. Ensure honey supers are in place. Colony is actively storing surplus honey.';
      break;
    case 'FLOW_STARTING':
      status = 'Pre-Flow';
      transitionAdvice = 'Nectar flow is starting. Queen egg-laying is stimulated. Colony is building comb and expanding the brood nest. Queen cells and swarm preparation risk are rising.';
      break;
    case 'FLOW_ENDING':
      status = 'Flow Ending';
      transitionAdvice = 'Nectar flow is shutting down rapidly. Queen egg-laying will slow down. Robbing behavior may rise; check honey stores.';
      break;
    case 'DEARTH':
      status = 'Dearth';
      transitionAdvice = 'Colony is in a dearth. Monitor food reserves closely. Supplemental feeding may be required to maintain colony strength.';
      break;
    case 'TRANSITION':
    default:
      status = 'Stable Low';
      transitionAdvice = 'Transition state. Monitor forage levels and colony strength.';
      break;
  }

  return {
    nfi,
    ratio: historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0,
    layer1Score: nfi,
    layer1Max: 100,
    slope,
    phenologyBoost: 0,
    status,
    transitionAdvice
  };
}
