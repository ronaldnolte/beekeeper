// UTC calendar-day helpers (FORMULAS §0, SCAR S-NEC-7). Never use local time here.

export const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → UTC midnight epoch ms. */
export function dayMs(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
}

/** UTC epoch ms → "YYYY-MM-DD". */
export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return isoDay(dayMs(date) + n * DAY_MS);
}

/** Today's UTC calendar day. */
export function todayUtc(now: number = Date.now()): string {
  return isoDay(now);
}

/** Engine day of year: 1 for 1 January (UTC). */
export function dayOfYear(date: string): number {
  return Math.round((dayMs(date) - Date.UTC(+date.slice(0, 4), 0, 1)) / DAY_MS) + 1;
}

/** Every UTC day from start to end inclusive. */
export function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = dayMs(start), e = dayMs(end); t <= e; t += DAY_MS) out.push(isoDay(t));
  return out;
}
