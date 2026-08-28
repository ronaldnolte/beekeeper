// Season helpers. Underscore-prefixed, so Vercel treats it as a module rather than a
// serverless function — the same convention as _lib.ts, and it keeps the 12-function cap
// clear.
//
// This exists because advice used to switch on the nectar phase alone, and the same phase
// means opposite things in each half of the year. In late August a New Mexico beekeeper was
// told "Queen egg-laying is stimulated. Colony is expanding — watch for swarm preparations."
// Spring advice, in autumn.

const DAY_MS = 86_400_000;

/** Day of year, UTC. Local time drifts by a day across daylight saving. */
export function dayOfYearUtc(d: Date): number {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY_MS);
}

/**
 * Hours of daylight at a latitude on a given day of year.
 *
 * Standard solar geometry: declination from the day of year, then the hour angle at which
 * the sun crosses the horizon. Inside the polar circles the hour angle has no solution —
 * the sun does not rise, or does not set — so the cosine is clamped, giving 0 or 24.
 */
export function dayLengthHours(lat: number, doy: number): number {
  const declination = 23.45 * Math.sin((2 * Math.PI * (284 + doy)) / 365);
  const phi = (lat * Math.PI) / 180;
  const delta = (declination * Math.PI) / 180;
  const cosH = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
  return (2 * Math.acos(cosH) * 180) / Math.PI / 15;
}

/**
 * Are the days getting longer?
 *
 * The split between advice for a colony BUILDING UP and one STORING FOR WINTER. Day length
 * rather than the calendar, because it is what the bees respond to and because it holds at
 * any latitude — a calendar split would hand Northern Hemisphere autumn advice to someone
 * in Australia in April.
 *
 * Compared over a week rather than a single day: within a few days of a solstice the change
 * is smaller than floating-point noise, and no colony's situation hinges on which side of
 * 21 June it is by one day.
 */
export function daysLengthening(date: Date, lat: number): boolean {
  const doy = dayOfYearUtc(date);
  return dayLengthHours(lat, doy + 3) > dayLengthHours(lat, doy - 3);
}

/**
 * First day of each month as a day-of-year offset, and the matching label.
 *
 * The chart plots data at its true day-of-year fraction while the month labels were spread
 * evenly edge to edge by flexbox. Those are different scales, and the error grew through the
 * year: the "Aug" label sat at 63.6% of the width where 1 August falls at 58.1%, about
 * twenty days out, and December was a full month adrift. Late August read as the start of
 * the month.
 */
export const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
