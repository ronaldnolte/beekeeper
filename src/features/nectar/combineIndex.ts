// Combining the two halves into one index.
//
//   bloom potential  — what the plant list says is open, from heat and day length
//   satellite factor — whether that bloom is actually there and watered
//
// The plant list answers WHEN. The satellite answers WHETHER. Neither instrument answers
// the other's question well, which is why they are separate terms rather than a blend.
//
// Deliberately NOT using the satellite's greening-rate core. Rate is a timing signal, and
// timing is now the plant list's job; feeding it in again would count the season twice.
// What the satellite uniquely knows is that the alfalfa was cut, the pasture was grazed,
// the spring never arrived, or the ground is irrigated when the weather says drought.

export interface SatelliteReading {
  /** Greenness against this location's own five-year range, 0-1. */
  vigor: number;
  /** Canopy water from NDWI, arriving already floored at 0.7 by the engine. */
  moisture: number;
}

/**
 * How much the satellite is allowed to cut the bloom number.
 *
 * A floor of 0.4 means a bad reading can take a bloom down to 40% of what the calendar
 * says, but never to nothing. That bound exists because a cloudy stretch or a bad pixel
 * must not silently erase a flow the beekeeper can watch happening in the yard — the
 * calendar is the more reliable of the two about whether plants exist at all.
 *
 * Ron asked for this to be adjustable rather than picked, so it is a parameter and the
 * ground-truth suite scores it.
 */
export const DEFAULT_SATELLITE_FLOOR = 0.4;

/**
 * Turn a satellite reading into a 0-1 strength.
 *
 * The engine hands moisture over already compressed into 0.7-1.0, so it is re-expanded
 * here before averaging — otherwise it would dominate vigor simply by never being small.
 * Averaged rather than multiplied: two independent 0-1 readings multiplied together drive
 * almost everything toward zero, which would make the floor the only thing that mattered.
 */
export function satelliteStrength(s: SatelliteReading): number {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const vigor = clamp01(s.vigor);
  // 0.7 -> 0, 1.0 -> 1.
  const moisture = clamp01((s.moisture - 0.7) / 0.3);
  return (vigor + moisture) / 2;
}

/**
 * Apply the satellite reading to a bloom potential.
 *
 * `floor` is the most the satellite may cut: 0.4 leaves at least 40%, 0 gives it full
 * authority to zero the number, 1 disables it entirely.
 */
export function applySatellite(
  bloomPotential: number,
  reading: SatelliteReading | null,
  floor = DEFAULT_SATELLITE_FLOOR
): number {
  if (!reading) return bloomPotential;
  const f = Math.min(1, Math.max(0, floor));
  return bloomPotential * (f + (1 - f) * satelliteStrength(reading));
}

export interface BloomPoint {
  date: string;
  potential: number;
}

export interface SatellitePoint {
  date: string;
  vigor?: number;
  moisture?: number;
}

export interface CombinedPoint {
  date: string;
  /** Bloom potential after the satellite factor, in the same raw units as the bloom curve. */
  combined: number;
  /** The bloom number before the satellite touched it, so the two can be compared. */
  bloom: number;
  /** What the satellite multiplied by, 0-1. Null where no satellite reading exists. */
  factor: number | null;
}

/**
 * Join the two daily series on date and combine them.
 *
 * Dates present in one series and not the other keep the bloom value untouched rather than
 * being dropped: the satellite record starts at its first usable scene and can have gaps,
 * and a missing observation is not evidence of a missing flow.
 */
export function combineSeries(
  bloom: BloomPoint[],
  satellite: SatellitePoint[],
  floor = DEFAULT_SATELLITE_FLOOR
): CombinedPoint[] {
  const sat = new Map<string, SatelliteReading>();
  for (const s of satellite) {
    if (s.vigor == null || s.moisture == null) continue;
    sat.set(s.date, { vigor: s.vigor, moisture: s.moisture });
  }

  return bloom.map(b => {
    const reading = sat.get(b.date) ?? null;
    return {
      date: b.date,
      bloom: b.potential,
      combined: applySatellite(b.potential, reading, floor),
      factor: reading ? satelliteStrength(reading) : null,
    };
  });
}
