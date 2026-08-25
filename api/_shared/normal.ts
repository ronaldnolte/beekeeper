// "What is normal for this date here?" — the same-calendar-day average across prior years.
//
// This is the quantity the product actually needs. Three skilled beekeepers validated the
// historical curve and the same formula draws the current year, so what was missing was
// never a better formula but the GAP between the two. It leads the absolute value by weeks.
//
// Five years, not three. Three similar seasons produced a spread of 0.06 where the true
// spread is 0.21, which made an ordinary year read as a five-sigma collapse. A deviation
// without a spread is uninterpretable: a -0.32 gap is extraordinary against 0.06 and
// unremarkable against 0.21.

const DAY_MS = 86_400_000;

/** 1-based, UTC. Local time drifts by a day across daylight saving, and the changeover
 *  date moves year to year, which bucketed prior years on misaligned keys. */
export function dayOfYearUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / DAY_MS);
}

export interface NormalPoint {
  /** Mean of this same calendar day across prior years. Null before enough history. */
  normal: number | null;
  /** value - normal. Positive = better than usual for the date. */
  deviation: number | null;
  /** Spread of prior years on this day. Below 2 years there is none. */
  spread: number | null;
  /** How many prior years contributed. Below 3, treat as indicative only. */
  normalYears: number;
}

/**
 * Attach normal/deviation/spread to a daily series. `dates` and `values` must be the same
 * length and in ascending date order; the last date's year is taken as the current one.
 */
export function withNormals(dates: string[], values: number[]): NormalPoint[] {
  const n = dates.length;
  if (!n) return [];

  const currentYear = parseInt(dates[n - 1].slice(0, 4), 10);
  const priorByDoy = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (parseInt(dates[i].slice(0, 4), 10) >= currentYear) continue;
    const k = dayOfYearUtc(dates[i]);
    const arr = priorByDoy.get(k);
    if (arr) arr.push(values[i]); else priorByDoy.set(k, [values[i]]);
  }

  const r3 = (v: number) => Math.round(v * 1000) / 1000;

  return dates.map((d, i) => {
    const prior = priorByDoy.get(dayOfYearUtc(d)) ?? [];
    const count = prior.length;
    const normal = count ? prior.reduce((a, b) => a + b, 0) / count : null;
    const spread = count > 1 && normal != null
      ? Math.sqrt(prior.reduce((a, b) => a + (b - normal) ** 2, 0) / count)
      : null;
    return {
      normal: normal == null ? null : r3(normal),
      deviation: normal == null ? null : r3(values[i] - normal),
      spread: spread == null ? null : r3(spread),
      normalYears: count,
    };
  });
}
