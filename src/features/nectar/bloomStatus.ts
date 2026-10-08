// Today's bloom status for the "What's blooming" section under Nectar. The server stores each nearby plant's
// normal-year start and end as month-day (api/_bloom/build.ts); the status is worked out here, day by day,
// with the Bloom workshop's bell curve (api/_bloom/table.ts — same settings, kept in step by the test).

export type BloomKind = 'nectar' | 'pollen' | 'both';

export interface BloomPlant {
  plant: string; // master-list ID (common name)
  presence: string; // 'Likely' | 'Possible' | 'Possible (wider area)'
  trigger: string;
  start: string | null; // 'MM-DD'
  end: string | null;
  note: string;
  scientific: string;
  kind: BloomKind;
  nectar: number;
  pollen: number;
}

export interface ApiaryBloom {
  radius_mi: number;
  limited: boolean;
  warning: string | null;
  normal_years: string;
  built_at: string;
  plants: BloomPlant[];
}

export type BloomStatus = 'in_bloom' | 'starting_soon' | 'winding_down' | 'not_yet' | 'finished';

// The workshop's settings (SETTINGS in api/_bloom/table.ts).
const DIVISOR = 4, MIN_SPREAD = 3, IN_BLOOM = 0.5, LOOKAHEAD = 14, WINDING_FLOOR = 0.15;

/** Day of the year (1 = 1 January) of a month-day in the given year. */
export function doyOf(year: number, md: string): number {
  const [m, d] = md.split('-').map(Number);
  return Math.round((Date.UTC(year, m - 1, d) - Date.UTC(year, 0, 0)) / 86_400_000);
}

/** Today's day of the year, by the device's own calendar. */
export function todayDoy(now: Date): number {
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86_400_000);
}

function bloomRate(doy: number, start: number, end: number): number {
  const peak = (start + end) / 2, sd = Math.max(MIN_SPREAD, (end - start) / DIVISOR);
  return Math.exp(-0.5 * ((doy - peak) / sd) ** 2);
}

export function bloomStatus(doy: number, start: number, end: number): BloomStatus {
  const r = bloomRate(doy, start, end);
  if (r >= IN_BLOOM) return 'in_bloom';
  if (doy < (start + end) / 2) return bloomRate(doy + LOOKAHEAD, start, end) >= IN_BLOOM ? 'starting_soon' : 'not_yet';
  return r >= WINDING_FLOOR ? 'winding_down' : 'finished';
}

export const STATUS_LABEL: Record<BloomStatus, string> = {
  in_bloom: 'May be in bloom',
  starting_soon: 'Starting soon',
  winding_down: 'Winding down',
  not_yet: 'Not yet',
  finished: 'Finished',
};

// Current bloom first (Ron, 2026-10-08), then what is coming, then what is past.
const STATUS_ORDER: Record<BloomStatus, number> = { in_bloom: 0, winding_down: 1, starting_soon: 2, not_yet: 3, finished: 4 };

export type SeasonName = 'Spring' | 'Summer' | 'Fall' | 'Winter';

/** Calendar seasons (Ron, 2026-10-08): Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov, Winter Dec-Feb. */
export function seasonOf(month: number /* 1-12 */): SeasonName {
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
}

export const NEXT_SEASON: Record<SeasonName, SeasonName> = { Winter: 'Spring', Spring: 'Summer', Summer: 'Fall', Fall: 'Winter' };

/** The season's day-of-year ranges in a year; winter is its two ends of the calendar year. */
function seasonRanges(season: SeasonName, year: number): [number, number][] {
  const d = (md: string) => doyOf(year, md);
  const lastFeb = d('03-01') - 1;
  switch (season) {
    case 'Spring': return [[d('03-01'), d('05-31')]];
    case 'Summer': return [[d('06-01'), d('08-31')]];
    case 'Fall': return [[d('09-01'), d('11-30')]];
    case 'Winter': return [[1, lastFeb], [d('12-01'), d('12-31')]];
  }
}

export interface SeasonRow extends BloomPlant {
  status: BloomStatus;
  startDoy: number;
  endDoy: number;
}

/** Every plant whose bloom overlaps the season, with today's status, current bloom first. */
export function seasonList(plants: BloomPlant[], season: SeasonName, now: Date): SeasonRow[] {
  const year = now.getFullYear(), today = todayDoy(now);
  const ranges = seasonRanges(season, year);
  const rows: SeasonRow[] = [];
  for (const p of plants) {
    if (!p.start || !p.end) continue; // not expected to bloom here in a normal year
    const s = doyOf(year, p.start), e = doyOf(year, p.end);
    if (!ranges.some(([a, b]) => s <= b && e >= a)) continue;
    rows.push({ ...p, status: bloomStatus(today, s, e), startDoy: s, endDoy: e });
  }
  return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startDoy - b.startDoy);
}

/** Days either side of today the section looks (Ron, 2026-10-08: "3 weeks", replacing the whole-season list). */
export const WINDOW_DAYS = 21;

/**
 * Plants blooming around today: in bloom, starting within `days`, or finished within the last `days`, current
 * bloom first. Works across New Year (a window from late December reaches into January).
 */
export function windowList(plants: BloomPlant[], now: Date, days = WINDOW_DAYS): SeasonRow[] {
  const year = now.getFullYear(), today = todayDoy(now);
  const rows: SeasonRow[] = [];
  for (const p of plants) {
    if (!p.start || !p.end) continue;
    const s0 = doyOf(year, p.start), e0 = doyOf(year, p.end);
    // The same window last year or next year can be the nearer one around New Year.
    const shift = [0, -365, 365].find((k) => s0 + k <= today + days && e0 + k >= today - days);
    if (shift === undefined) continue;
    const s = s0 + shift, e = e0 + shift;
    rows.push({ ...p, status: bloomStatus(today, s, e), startDoy: s, endDoy: e });
  }
  return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startDoy - b.startDoy);
}

/** The first bloom of the year here: the earliest start date among the plants. */
export function firstBloomStart(plants: BloomPlant[]): string | null {
  const starts = plants.map((p) => p.start).filter((s): s is string => !!s).sort();
  return starts[0] ?? null;
}

/** 'Mar 7' from 'MM-DD'. */
export function formatMonthDay(md: string): string {
  const [m, d] = md.split('-').map(Number);
  return new Date(Date.UTC(2025, m - 1, d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
