// Pure season/bloom-window maths. No I/O and no imports, so it is directly testable and
// runnable outside the serverless handler — the same separation that made the nectar
// engine testable.

export type BloomStatus = 'upcoming' | 'starting' | 'peak' | 'ending' | 'over';

export const GDD_BASE_F = 50;
export const DAY_MS = 86_400_000;

export const dayOfYearUTC = (d: Date) =>
  Math.floor(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS
  );

/** "MM-DD" -> day of year, in a non-leap reference year. */
export function mmddToDoy(mmdd: string): number | null {
  const parts = mmdd.split('-');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10), d = parseInt(parts[1], 10);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return Math.floor((Date.UTC(2025, m - 1, d) - Date.UTC(2025, 0, 1)) / DAY_MS);
}

export interface SeasonOffset {
  /** Days ahead of a normal season. Positive = running early. */
  offset: number;
  gddToDate: number;
  comparedYears: number;
}

/**
 * How far ahead of (or behind) a normal season this year is running, measured in days,
 * from accumulated warmth alone.
 *
 * The bloom windows we hold are calendar priors, and a fixed calendar is blind to the
 * year actually happening — Albuquerque hit 90F in March 2026 and bloom ran weeks early.
 * Per-species GDD thresholds would handle that properly but are not populated yet, so
 * this derives a WHOLE-SEASON shift instead: accumulate growing degree days from Jan 1,
 * find the day prior years reached today's total, and take the difference. It needs no
 * species data, and per-species GDD refines it later without changing the shape.
 *
 * Returns an offset of 0 when there is nothing to compare against, which makes the
 * caller fall back to the plain calendar rather than inventing a shift.
 */
export function seasonOffsetDays(
  days: { date: string; tmax: number; tmin: number }[],
  today: Date
): SeasonOffset {
  const currentYear = today.getUTCFullYear();
  const cum: Record<number, { doy: number; total: number }[]> = {};

  for (const d of days) {
    const year = parseInt(d.date.slice(0, 4), 10);
    const doy = mmddToDoy(d.date.slice(5));
    if (!Number.isFinite(year) || doy == null) continue;
    const gdd = Math.max(0, (d.tmax + d.tmin) / 2 - GDD_BASE_F);
    if (!cum[year]) cum[year] = [];
    const prev = cum[year].length ? cum[year][cum[year].length - 1].total : 0;
    cum[year].push({ doy, total: prev + gdd });
  }

  const todayDoy = dayOfYearUTC(today);
  const thisYear = cum[currentYear] ?? [];
  const gddToDate = thisYear.length ? thisYear[thisYear.length - 1].total : 0;
  if (!gddToDate) return { offset: 0, gddToDate: 0, comparedYears: 0 };

  const priorDoys: number[] = [];
  for (const [yearStr, series] of Object.entries(cum)) {
    const year = parseInt(yearStr, 10);
    if (year >= currentYear) continue;
    const hit = series.find(p => p.total >= gddToDate);
    // A year that never reached this year's total says the season is ahead of anything on
    // record, but not by how much. Averaging it in as "no difference" would understate,
    // so it is skipped.
    if (hit) priorDoys.push(hit.doy);
  }
  if (!priorDoys.length) return { offset: 0, gddToDate: Math.round(gddToDate), comparedYears: 0 };

  const normalDoy = priorDoys.reduce((a, b) => a + b, 0) / priorDoys.length;
  return {
    offset: Math.round(normalDoy - todayDoy),
    gddToDate: Math.round(gddToDate),
    comparedYears: priorDoys.length,
  };
}

/** Where today sits inside a bloom window, all in day-of-year terms. */
export function statusFor(
  startDoy: number,
  peakDoy: number,
  endDoy: number,
  todayDoy: number
): BloomStatus {
  if (todayDoy < startDoy) return 'upcoming';
  if (todayDoy > endDoy) return 'over';
  if (Math.abs(todayDoy - peakDoy) <= 7) return 'peak';
  return todayDoy < peakDoy ? 'starting' : 'ending';
}
