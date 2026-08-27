// Beekeeper ground truth, as data.
//
// NOT a .test.ts file on purpose — jest's testMatch only picks up *.test.ts, so this is a
// plain module that both the test suite and the fetcher experiments import. One definition
// of what "correct" means, so an experiment cannot be scored against a different bar than
// the tests enforce.
//
// Every check traces to something a beekeeper reported first hand. See the notes on each.

import { runV2Pipeline, type Phase } from '../_shared/nectar-v2-engine';
import type { MultiBandRecord } from '../_shared/bands-fetcher';
import type { WeatherDay } from '../_shared/weather';

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
export type MonthKey = typeof MONTHS[number];
export type Monthly = Record<MonthKey, number>;

export interface SiteResult {
  monthly: Monthly;                      // the reference year, below
  byYear: Record<string, Monthly>;
  phaseSwitches: number;                 // per year
  phaseCount: Partial<Record<Phase, number>>;
}

/**
 * The original suite scored ONE year, the most recent complete season. Averaging every year
 * flattens the peaks the beekeepers are attesting to — it dropped South Valley
 * September-October from 39 to 21 and turned a passing chamisa check into a failure that
 * was really just dilution.
 */
export const REFERENCE_YEAR = '2025';

export function summarise(
  records: MultiBandRecord[],
  weather: Record<string, WeatherDay>,
  lat: number
): SiteResult {
  const r = runV2Pipeline(records, weather, lat);

  const bucket: Record<string, number[][]> = {};
  const all: number[][] = MONTHS.map(() => []);
  for (let i = 0; i < r.dates.length; i++) {
    const [y, m] = r.dates[i].split('-');
    const mi = Number(m) - 1;
    const v = r.idxEwma[i] * 100;
    all[mi].push(v);
    (bucket[y] ??= MONTHS.map(() => []))[mi].push(v);
  }
  const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const toMonthly = (rows: number[][]) =>
    Object.fromEntries(MONTHS.map((k, i) => [k, mean(rows[i])])) as Monthly;

  const phaseCount: Partial<Record<Phase, number>> = {};
  let switches = 0;
  for (let i = 0; i < r.phases.length; i++) {
    phaseCount[r.phases[i]] = (phaseCount[r.phases[i]] ?? 0) + 1;
    if (i > 0 && r.phases[i] !== r.phases[i - 1]) switches++;
  }
  const years = new Set(r.dates.map(d => d.slice(0, 4))).size || 1;
  const byYear = Object.fromEntries(Object.entries(bucket).map(([y, rows]) => [y, toMonthly(rows)]));

  return {
    monthly: byYear[REFERENCE_YEAR] ?? toMonthly(all),
    byYear,
    phaseSwitches: Math.round(switches / years),
    phaseCount: Object.fromEntries(
      Object.entries(phaseCount).map(([k, v]) => [k, Math.round((v as number) / years)])
    ) as Partial<Record<Phase, number>>,
  };
}

export interface Check {
  id: string;
  site: 'south_valley' | 'murfreesboro' | 'tijeras';
  desc: string;
  /** Asserted only where it should hold. Tijeras quality metrics are reported, not asserted. */
  advisory?: boolean;
  run: (s: SiteResult) => boolean;
}

const low = (s: SiteResult, keys: MonthKey[], limit: number) =>
  keys.every(k => s.monthly[k] <= limit);

export const CHECKS: Check[] = [
  // --- South Valley, Albuquerque NM: irrigated Rio Grande bottomland ---
  { id: 'sv-winter-dead', site: 'south_valley',
    desc: 'Dec-Feb essentially zero (winter dearth, no forage)',
    run: s => low(s, ['Dec', 'Jan', 'Feb'], 5) },
  { id: 'sv-may-flow', site: 'south_valley',
    desc: 'May spring flow is a local peak',
    run: s => s.monthly.May > s.monthly.Apr * 0.9 && s.monthly.May >= 35 },
  { id: 'sv-fall-chamisa', site: 'south_valley',
    desc: 'Sep-Oct chamisa/rabbitbrush fall flow',
    run: s => Math.max(s.monthly.Sep, s.monthly.Oct) >= 35 },
  { id: 'sv-monsoon-varies', site: 'south_valley',
    desc: 'Jul-Aug differs across years (2024 monsoon vs 2026 dry Rio Grande)',
    run: s => {
      const peaks = Object.values(s.byYear).map(m => Math.max(m.Jul, m.Aug));
      return Math.max(...peaks) - Math.min(...peaks) >= 20;
    } },

  // --- Murfreesboro TN: rural, lush. Ron was physically present Jul-Aug 2026. ---
  { id: 'tn-winter-dormant', site: 'murfreesboro',
    desc: 'Dec-Feb dormant',
    run: s => low(s, ['Dec', 'Jan', 'Feb'], 10) },
  { id: 'tn-spring-flow', site: 'murfreesboro',
    desc: 'Mar-May spring flow is the seasonal high',
    run: s => Math.max(s.monthly.Mar, s.monthly.Apr, s.monthly.May) >= 50 },
  { id: 'tn-summer-dearth', site: 'murfreesboro',
    desc: 'Jul-Aug midsummer dearth, well below the spring flow',
    run: s => Math.max(s.monthly.Jul, s.monthly.Aug) < Math.max(s.monthly.Apr, s.monthly.May) * 0.5 },
  { id: 'tn-fall-goldenrod', site: 'murfreesboro',
    desc: 'Sep-Oct goldenrod rises back above the summer dearth',
    run: s => Math.max(s.monthly.Sep, s.monthly.Oct) > Math.max(s.monthly.Jul, s.monthly.Aug) },
  { id: 'tn-2026-july-empty', site: 'murfreesboro',
    desc: 'July 2026 a hard dearth — both hives empty, feeding started',
    run: s => (s.byYear['2026']?.Jul ?? 99) <= 10 },

  // --- Tijeras NM: OUT-OF-SAMPLE. A third-party beekeeper's account, nothing tuned on it. ---
  { id: 'tij-winter-dead', site: 'tijeras',
    desc: 'Dec-Feb essentially zero at 6539 ft',
    run: s => low(s, ['Dec', 'Jan', 'Feb'], 8) },
  { id: 'tij-2026-spring-fail', site: 'tijeras',
    desc: 'Spring 2026 failed — 0.02in March rain, greenness fell',
    run: s => Math.max(s.byYear['2026']?.Apr ?? 99, s.byYear['2026']?.May ?? 99) <= 10 },
  { id: 'tij-2026-summer-miss', site: 'tijeras',
    desc: 'Summer flow 2026 missed by the beekeeper — June must not show a flow',
    run: s => (s.byYear['2026']?.Jun ?? 99) <= 10 },

  // --- Quality, asserted where it should hold ---
  { id: 'sv-phase-stability', site: 'south_valley',
    desc: 'Phase switches <= 12/yr', run: s => s.phaseSwitches <= 12 },
  { id: 'sv-in-flow-reachable', site: 'south_valley',
    desc: 'IN_FLOW >= 20 days/yr', run: s => (s.phaseCount.IN_FLOW ?? 0) >= 20 },
  { id: 'tn-phase-stability', site: 'murfreesboro',
    desc: 'Phase switches <= 12/yr', run: s => s.phaseSwitches <= 12 },
  { id: 'tn-in-flow-reachable', site: 'murfreesboro',
    desc: 'IN_FLOW >= 20 days/yr', run: s => (s.phaseCount.IN_FLOW ?? 0) >= 20 },

  // Advisory: a low-dynamic-range mountain site averaging communities that green up weeks
  // apart. Relief across its disc is 2425 ft against 479 at South Valley. Reported so a
  // change that improves it is visible, not asserted so a change that fixes it breaks CI.
  { id: 'tij-phase-stability', site: 'tijeras', advisory: true,
    desc: 'Phase switches <= 12/yr (advisory)', run: s => s.phaseSwitches <= 12 },
  { id: 'tij-in-flow-reachable', site: 'tijeras', advisory: true,
    desc: 'IN_FLOW >= 20 days/yr (advisory)', run: s => (s.phaseCount.IN_FLOW ?? 0) >= 20 },
];

/** Real, and untestable by a scalar disc mean: a large alfalfa farm 1.5-2.0 mi out blooms
 *  while the surrounding land is in dearth, and one average over the disc can represent
 *  neither. Needs stratification by land cover, not a different threshold. */
export const UNTESTABLE = ['sv-june-alfalfa'];
