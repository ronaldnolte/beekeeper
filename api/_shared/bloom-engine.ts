// Bloom-driven nectar index. Pure — takes plants + weather, returns a daily base curve.
//
// This inverts the V2 architecture. V2 measures the ground from orbit and adds a small,
// species-blind autumn allowance. Here the collective bloom IS the base, and satellite
// readings modulate how hard that bloom is actually running.
//
//   potential(t) = the open plants combined, best first, each further one worth half
//   openness     = where the plant sits on its own production curve today
//
// Three ideas do the work.
//
// 1. THE CURVE IS THE WEIGHT. A plant does not produce evenly across its window — the last
//    week of a bloom is not the middle of it. Each plant carries a smooth rise to peak and
//    a decline to close, so a plant at peak counts fully and one in its tail barely counts.
//    Overlapping curves add. That removes any need for a separate abundance figure: the
//    shape comes from botany rather than from a curator estimating acreage.
//
// 2. THRESHOLDS ARE DERIVED, NOT PUBLISHED. Per-species growing-degree-day tables do not
//    exist for most of this list. But we hold a calendar window per zone and five years of
//    weather per location, and that is enough: if the seed says chamisa peaks 15 September
//    in the Rio Grande floodplain, and 15 September at that apiary has averaged some
//    accumulated warmth over five years, that figure becomes the threshold. The plant then
//    tracks heat instead of the calendar, and it calibrates itself per location.
//
// 3. OPEN PLANTS DO NOT SIMPLY ADD. Summing them counts species rather than nectar. On the
//    real Rio Grande list a plain sum put mid-June at 2.79 and mid-September at 1.00 — so
//    chamisa at full peak, which is arguably the best surplus flow of the year there, scored
//    a third of June purely because June has five species overlapping and September has one.
//    Under absolute phase thresholds that labels every autumn a dearth by construction.
//    So contributions combine best-first with each further plant worth half the last. A
//    colony's foraging capacity is finite: a strong single-species flow saturates it much as
//    a diverse one does, and extra species buy duration and insurance rather than
//    proportionally more nectar. That puts June at 1.5x September, which is the ratio the
//    beekeeper reports.
//
// Spring and summer plants are heat-driven, so their windows slide with accumulated warmth.
// Fall plants are day-length-driven — chamisa, goldenrod, aster and snakeweed are short-day
// species — so their windows must NOT slide. In an anomalous year a heat shift makes them
// more wrong, not less. That distinction is the whole content of the trigger type.

import { GDD_BASE_F, DAY_MS, mmddToDoy } from './season.js';

export type BloomTrigger = 'gdd' | 'photoperiod';

export interface PlantWindow {
  name: string;
  /** MM-DD calendar prior from the zone research. */
  bloomStart: string;
  bloomPeak: string;
  bloomEnd: string;
  /** 0-1. Scales the height of this plant's curve — how much nectar it yields when open. */
  nectarValue: number;
  /** Heat-driven (spring/summer) or day-length-driven (fall). Derived when absent. */
  trigger?: BloomTrigger;
}

export interface DailyTemp {
  date: string;
  tmax: number;
  tmin: number;
}

/** One plant's contribution on one day, for explaining a number back to a beekeeper. */
export interface PlantContribution {
  name: string;
  openness: number;
  nectarValue: number;
  contribution: number;
  trigger: BloomTrigger;
}

export interface BloomBaseResult {
  dates: string[];
  /**
   * Blooming potential in raw units, NOT scaled to this location's own year. One excellent
   * plant at full peak reads about 0.9; everything conceivable open at once approaches 2.0.
   * Deliberately not normalised: dividing by the location's annual maximum forces every
   * apiary to touch 100 once a year whatever its landscape, and structurally suppresses any
   * season that runs on a single dominant plant. Scaling happens once at the end, after the
   * satellite modifier.
   */
  potential: number[];
  /** Per-plant breakdown on the final day. */
  latestBreakdown: PlantContribution[];
  /** Derived thresholds actually used, so they can be inspected. */
  thresholds: { name: string; trigger: BloomTrigger; start: number; peak: number; end: number }[];
  /** Days in the window where nothing is open at all. A gap in the list, not a dearth. */
  emptyDays: number;
}

/**
 * A fall bloomer is a short-day plant. Anything peaking from August onward is treated as
 * day-length-driven unless the row says otherwise; earlier peaks track heat. Crude, but it
 * matches the botany that matters here and it is one column away from being explicit.
 */
export function defaultTrigger(bloomPeak: string): BloomTrigger {
  const doy = mmddToDoy(bloomPeak);
  return doy != null && doy >= 213 ? 'photoperiod' : 'gdd';
}

/**
 * Accumulated growing degree days from 1 January, base 50F, keyed by date.
 * Restarts each calendar year — the count is a measure of how far into the growing season
 * this particular year has travelled, so it cannot carry across the turn.
 */
export function accumulateGdd(days: DailyTemp[]): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let year = '';
  let acc = 0;
  for (const d of sorted) {
    const y = d.date.slice(0, 4);
    if (y !== year) { year = y; acc = 0; }
    acc += Math.max(0, (d.tmax + d.tmin) / 2 - GDD_BASE_F);
    out.set(d.date, acc);
  }
  return out;
}

/** Day of year, 1-based, UTC. Matches the convention in nectar-v2-engine. */
function doyOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / DAY_MS);
}

/**
 * Convert one calendar landmark into the accumulated warmth that landmark has historically
 * arrived at. Averaged across every prior year we hold, so a single freak season cannot set
 * the threshold. Years where the record does not reach that date are skipped rather than
 * contributing a partial total, which would drag the average down.
 */
function gddAtCalendarDate(mmdd: string, gdd: Map<string, number>, years: string[]): number | null {
  const vals: number[] = [];
  for (const y of years) {
    const key = `${y}-${mmdd}`;
    const v = gdd.get(key);
    if (v != null) vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Openness: where a plant sits on its own production curve, 0 to 1.
 *
 * Raised cosine on each side of the peak, so the curve leaves the ground smoothly, tops out
 * at 1, and settles smoothly back — and the rise and fall can be different lengths, which
 * they usually are. A triangle would give a plant its full value the day before it closes;
 * this does not.
 */
/**
 * Combine the open plants into one figure.
 *
 * Best plant counts fully, the next half, the next a quarter. See note 3 at the top for why
 * a plain sum is wrong. Order matters, so this sorts rather than trusting the caller.
 */
export function combineContributions(contributions: number[]): number {
  return [...contributions]
    .sort((a, b) => b - a)
    .reduce((acc, c, i) => acc + c * Math.pow(0.5, i), 0);
}

export function openness(x: number, start: number, peak: number, end: number): number {
  if (!(x > start) || !(x < end)) return 0;
  if (x <= peak) {
    const span = peak - start;
    if (span <= 0) return 1;
    return 0.5 * (1 - Math.cos(Math.PI * ((x - start) / span)));
  }
  const span = end - peak;
  if (span <= 0) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * ((x - peak) / span)));
}

/**
 * The collective bloom curve for one apiary.
 *
 * `temps` should span several years: the prior years set each heat-driven plant's threshold,
 * and the current year is then measured against it.
 */
export function computeBloomBase(plants: PlantWindow[], temps: DailyTemp[]): BloomBaseResult {
  const empty: BloomBaseResult = {
    dates: [], potential: [], latestBreakdown: [], thresholds: [], emptyDays: 0,
  };
  if (!plants.length || !temps.length) return empty;

  const sorted = [...temps].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map(d => d.date);
  const gdd = accumulateGdd(sorted);

  const allYears = [...new Set(dates.map(d => d.slice(0, 4)))].sort();
  const currentYear = allYears[allYears.length - 1];
  const priorYears = allYears.filter(y => y < currentYear);
  // With no prior years there is nothing to derive a threshold from, so heat-driven plants
  // fall back to their calendar window rather than silently reading zero all season.
  const thresholdYears = priorYears.length ? priorYears : allYears;

  const specs = plants.map(p => {
    const trigger = p.trigger ?? defaultTrigger(p.bloomPeak);
    if (trigger === 'photoperiod') {
      // Day length does not vary between years, so a short-day plant's window stays put on
      // the calendar. Holding it still IS the mechanism — it withholds the heat shift that
      // would otherwise drag an autumn bloom weeks early in a hot year.
      return {
        name: p.name, trigger, nectarValue: p.nectarValue,
        start: mmddToDoy(p.bloomStart), peak: mmddToDoy(p.bloomPeak), end: mmddToDoy(p.bloomEnd),
      };
    }
    const start = gddAtCalendarDate(p.bloomStart, gdd, thresholdYears);
    const peak  = gddAtCalendarDate(p.bloomPeak,  gdd, thresholdYears);
    const end   = gddAtCalendarDate(p.bloomEnd,   gdd, thresholdYears);
    if (start == null || peak == null || end == null) {
      return {
        name: p.name, trigger: 'photoperiod' as BloomTrigger, nectarValue: p.nectarValue,
        start: mmddToDoy(p.bloomStart), peak: mmddToDoy(p.bloomPeak), end: mmddToDoy(p.bloomEnd),
      };
    }
    return { name: p.name, trigger, nectarValue: p.nectarValue, start, peak, end };
  }).filter(s => s.start != null && s.peak != null && s.end != null) as {
    name: string; trigger: BloomTrigger; nectarValue: number;
    start: number; peak: number; end: number;
  }[];

  const potential: number[] = [];
  let latestBreakdown: PlantContribution[] = [];

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const heat = gdd.get(d) ?? 0;
    const doy = doyOf(d);
    const breakdown: PlantContribution[] = [];
    for (const s of specs) {
      const x = s.trigger === 'gdd' ? heat : doy;
      const o = openness(x, s.start, s.peak, s.end);
      if (o > 0) {
        breakdown.push({
          name: s.name, openness: o, nectarValue: s.nectarValue,
          contribution: o * s.nectarValue, trigger: s.trigger,
        });
      }
    }
    potential.push(combineContributions(breakdown.map(b => b.contribution)));
    if (i === dates.length - 1) {
      latestBreakdown = breakdown.sort((a, b) => b.contribution - a.contribution);
    }
  }

  // Days where the list offers nothing at all. That is a hole in the research, not a dearth,
  // and it must be visible rather than being reported to a beekeeper as zero forage.
  const emptyDays = dates
    .map((d, i) => ({ d, v: potential[i] }))
    .filter(x => x.d.startsWith(currentYear) && x.v <= 0).length;

  return {
    dates, potential, latestBreakdown, emptyDays,
    thresholds: specs.map(s => ({
      name: s.name, trigger: s.trigger, start: s.start, peak: s.peak, end: s.end,
    })),
  };
}
