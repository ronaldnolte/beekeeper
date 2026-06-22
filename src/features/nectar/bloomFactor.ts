export interface PlantProfileEntry {
  name: string;
  bloom_start: string;     // MM-DD
  bloom_peak: string;      // MM-DD
  bloom_end: string;       // MM-DD
  gdd_start?: number | null;
  gdd_peak?: number | null;
  gdd_end?: number | null;
}

export interface BloomFactorInput {
  date: string;            // ISO date
  lat: number;
  lon: number;
  forage_radius_km?: number;
  plant_profile: PlantProfileEntry[];
  gdd_value?: number | null;
}

export interface BloomFactorResult {
  date: string;
  bloom_factor: number;
}

/**
 * Calculates day of year (1-366) for a given Date in UTC.
 */
export function getDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor((current - start) / oneDay);
}

/**
 * Parses "MM-DD" and returns the Day of Year (1-366) in the context of the given year using UTC.
 */
export function parseMonthDayToDoY(mdStr: string, year: number): number {
  const parts = mdStr.trim().split('-');
  if (parts.length !== 2) {
    throw new Error(`Malformed date: ${mdStr}`);
  }
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid month/day values in ${mdStr}`);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return getDayOfYear(date);
}

/**
 * Checks if a target day-of-year is within a start and end day-of-year range,
 * correctly supporting wrapping across the calendar year boundary.
 */
export function isTargetInWindow(target: number, start: number, end: number): boolean {
  if (start <= end) {
    return target >= start && target <= end;
  } else {
    // Calendar wrapping case (e.g. Dec to Jan)
    return target >= start || target <= end;
  }
}

/**
 * Calculates triangular bloom curve value (0.0 to 1.0) given target, start, peak, and end.
 * Handles the calendar year-wrap boundary (e.g., start in Dec, end in Jan).
 */
export function calculateTriangularValue(target: number, start: number, peak: number, end: number): number {
  // Clamp boundaries to valid ranges
  const maxVal = 366; // standardizing on day of year range
  
  if (start <= end) {
    // Non-wrapping case
    if (target < start || target > end) return 0;
    if (target === peak) return 1;
    if (target < peak) {
      const denom = peak - start;
      return denom > 0 ? (target - start) / denom : 1;
    } else {
      const denom = end - peak;
      return denom > 0 ? (end - target) / denom : 0;
    }
  } else {
    // Wrapping case (e.g., start = 350, end = 20)
    let adjEnd = end + maxVal;
    let adjPeak = peak;
    if (peak < start) adjPeak += maxVal;
    
    let adjTarget = target;
    if (target < start) adjTarget += maxVal;
    
    if (adjTarget < start || adjTarget > adjEnd) return 0;
    if (adjTarget === adjPeak) return 1;
    if (adjTarget < adjPeak) {
      const denom = adjPeak - start;
      return denom > 0 ? (adjTarget - start) / denom : 1;
    } else {
      const denom = adjEnd - adjPeak;
      return denom > 0 ? (adjEnd - adjTarget) / denom : 0;
    }
  }
}

/**
 * General triangular curve calculator for non-wrapped numbers (used for GDD)
 */
function calculateGddTriangularValue(target: number, start: number, peak: number, end: number): number {
  if (target < start || target > end) return 0;
  if (target === peak) return 1;
  if (target < peak) {
    const denom = peak - start;
    return denom > 0 ? (target - start) / denom : 1;
  } else {
    const denom = end - peak;
    return denom > 0 ? (end - target) / denom : 0;
  }
}

/**
 * Computes a bloom factor between 0.0 and 1.0 based on species-level bloom profiles and optional GDD adjustments.
 */
export function computeBloomFactor(input: BloomFactorInput): BloomFactorResult {
  const { date, plant_profile, gdd_value } = input;

  if (!plant_profile || plant_profile.length === 0) {
    return { date, bloom_factor: 0.0 };
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    console.warn(`Invalid ISO date format in Bloom Factor: ${date}`);
    return { date, bloom_factor: 0.0 };
  }

  const year = parsedDate.getFullYear();
  const targetDoY = getDayOfYear(parsedDate);

  // Use the STRONGEST active bloom, not the average of active plants. Averaging
  // caused a cliff: when a plant fading to ~0 dropped out of the "active" set,
  // dividing by fewer plants made the factor jump in a single day.
  let maxIntensity = 0;

  for (const plant of plant_profile) {
    try {
      // 1. Calculate Date-based bloom curve
      const doyStart = parseMonthDayToDoY(plant.bloom_start, year);
      const doyPeak = parseMonthDayToDoY(plant.bloom_peak, year);
      const doyEnd = parseMonthDayToDoY(plant.bloom_end, year);

      // Only evaluate and average the plant if today is within its active bloom window
      if (isTargetInWindow(targetDoY, doyStart, doyEnd)) {
        const dateBloom = calculateTriangularValue(targetDoY, doyStart, doyPeak, doyEnd);

        // 2. Calculate GDD-based bloom curve if parameters and value are available
        let gddBloom = null;
        const hasGddParams = plant.gdd_start !== undefined && plant.gdd_start !== null &&
                            plant.gdd_peak !== undefined && plant.gdd_peak !== null &&
                            plant.gdd_end !== undefined && plant.gdd_end !== null;
        const hasGddValue = gdd_value !== undefined && gdd_value !== null;

        if (hasGddParams && hasGddValue) {
          gddBloom = calculateGddTriangularValue(
            gdd_value!,
            plant.gdd_start!,
            plant.gdd_peak!,
            plant.gdd_end!
          );
        }

        // 3. Combine curves
        let bloomFinal = dateBloom;
        if (gddBloom !== null) {
          bloomFinal = (dateBloom + gddBloom) / 2;
        }

        // Clamp individual plant bloom
        bloomFinal = Math.min(1.0, Math.max(0.0, bloomFinal));

        maxIntensity = Math.max(maxIntensity, bloomFinal);
      }
    } catch (err: any) {
      // Malformed date/GDD format -> log and skip that plant
      console.warn(`Skipping plant "${plant.name}" due to parsing error: ${err.message}`);
    }
  }

  const clampedBloomFactor = Math.min(1.0, Math.max(0.0, maxIntensity));

  return {
    date,
    bloom_factor: clampedBloomFactor
  };
}
