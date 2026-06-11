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
  bloom_factor: number | null;
  temp_suitability?: number | null;
  rain_suitability?: number | null;
  wind_suitability?: number | null;
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

  // 1. Calculate raw forage index for each day
  const rawForageList = history.map(item => {
    // If NDVI is missing, we cannot compute
    if (item.ndvi === undefined || item.ndvi === null || isNaN(item.ndvi)) {
      return { date: item.date, forage_raw: null, vigor: null };
    }

    const ndvi = Math.min(1.0, Math.max(0.0, item.ndvi));
    const ndvi_min = item.ndvi_min !== null && item.ndvi_min !== undefined ? Math.min(1.0, Math.max(0.0, item.ndvi_min)) : 0.0;
    const ndvi_max = item.ndvi_max !== null && item.ndvi_max !== undefined ? Math.min(1.0, Math.max(0.0, item.ndvi_max)) : 1.0;
    const bloom = item.bloom_factor !== null && item.bloom_factor !== undefined ? Math.min(1.0, Math.max(0.0, item.bloom_factor)) : 0.0;

    // Vigor = (ndvi - ndvi_min) / (ndvi_max - ndvi_min)
    let vigor = 0.0;
    const ndviRange = ndvi_max - ndvi_min;
    if (ndviRange > 0.05) {
      vigor = (ndvi - ndvi_min) / ndviRange;
      vigor = Math.min(1.0, vigor / 0.6); // Reaches 1.0 at 60% of max green-up
    } else {
      // Robust fallback for extremely flat NDVI ranges (constant greenness or desert)
      vigor = Math.min(1.0, Math.max(0.0, (ndvi - 0.2) / 0.4));
    }
    vigor = Math.min(1.0, Math.max(0.0, vigor));

    // Weather suitability (propagate nulls)
    let weather: number | null = null;
    const hasWeather = item.temp_suitability !== undefined && item.temp_suitability !== null &&
                      item.rain_suitability !== undefined && item.rain_suitability !== null &&
                      item.wind_suitability !== undefined && item.wind_suitability !== null;

    if (hasWeather) {
      const temp = Math.min(1.0, Math.max(0.0, item.temp_suitability!));
      const rain = Math.min(1.0, Math.max(0.0, item.rain_suitability!));
      const wind = Math.min(1.0, Math.max(0.0, item.wind_suitability!));
      weather = temp * rain * wind;
      weather = Math.min(1.0, Math.max(0.0, weather));
    }

    // forage_raw: pure NDVI vigor — bloom and weather are not in the formula
    const forage_raw = Math.min(1.0, Math.max(0.0, vigor));

    return {
      date: item.date,
      forage_raw,
      vigor
    };
  });

  // 2. First pass: Compute 7-day moving average and delta
  const computedList = history.map((item, idx) => {
    // 7-day moving average of forage_raw
    let smoothed: number | null = null;
    let delta: number | null = null;

    // Check if we have enough history (need at least 7 days for today's average)
    if (idx >= 6) {
      let isWindowValid = true;
      let sum = 0;
      for (let i = idx - 6; i <= idx; i++) {
        const val = rawForageList[i].forage_raw;
        if (val === null || val === undefined) {
          isWindowValid = false;
          break;
        }
        sum += val;
      }
      if (isWindowValid) {
        smoothed = sum / 7;
      }
    }

    // delta_forage = smoothed_today - smoothed_yesterday
    if (smoothed !== null && idx >= 7) {
      let isPrevWindowValid = true;
      let prevSum = 0;
      for (let i = idx - 7; i <= idx - 1; i++) {
        const val = rawForageList[i].forage_raw;
        if (val === null || val === undefined) {
          isPrevWindowValid = false;
          break;
        }
        prevSum += val;
      }
      if (isPrevWindowValid) {
        const prevSmoothed = prevSum / 7;
        delta = smoothed - prevSmoothed;
      }
    }

    return {
      date: item.date,
      forage_index_raw: rawForageList[idx].forage_raw,
      forage_index_smoothed: smoothed,
      delta_forage: delta,
      ndvi: item.ndvi
    };
  });

  // Find the peak smoothed value in the last 90 days (representing the current season's high)
  const recentList = computedList.slice(-90);
  const validSmoothed = recentList.map(c => c.forage_index_smoothed).filter(v => v !== null && !isNaN(v)) as number[];
  const maxSmoothed = validSmoothed.length > 0 ? Math.max(...validSmoothed) : 0.20;

  // Calculate dynamic classification thresholds relative to maxSmoothed
  const FLOW_ENTER_THRESHOLD = Math.min(0.30, Math.max(0.12, maxSmoothed * 0.60));
  const FLOW_EXIT_THRESHOLD  = Math.min(0.20, Math.max(0.08, maxSmoothed * 0.40));
  const DELTA_UP   = Math.min(0.02, Math.max(0.005, maxSmoothed * 0.04));
  const DELTA_DOWN = Math.max(-0.02, Math.min(-0.005, maxSmoothed * -0.04));

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
