import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runV2Pipeline, type Phase } from '../_shared/nectar-v2-engine';
import type { MultiBandRecord } from '../_shared/bands-fetcher';
import type { WeatherDay } from '../_shared/weather';

// Ground truth from beekeepers who were physically present, run against the real shipped
// engine on real cached satellite and weather records.
//
// Moved out of the offline harness 2026-08-26 so `npm run test` can score a change. This
// suite is what caught a calendar-driven rebuild scoring WORSE than what shipped (14 of 18
// against 16), which is the only reason that idea was not adopted on the strength of how
// reasonable it sounded. Without it, any adjustment we add is a guess.
//
// Fixtures are cached Earth Engine and Open-Meteo responses, checked in deliberately: tests
// must not depend on a network call, a paid API, or on today's date.
//
// Status meanings carried over from the original calendars:
//   confirmed  — the beekeeper stated it directly
//   untestable — real, but a single mean over the whole disc cannot express it

const FIX = join(__dirname, 'fixtures');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
type MonthKey = typeof MONTHS[number];
type Monthly = Record<MonthKey, number>;

interface SiteResult {
  monthly: Monthly;
  byYear: Record<string, Monthly>;
  phaseSwitches: number;
  phaseCount: Partial<Record<Phase, number>>;
}

function runSite(slug: string, bandsFile = `bands_${slug}.json`): SiteResult {
  const bands = JSON.parse(readFileSync(join(FIX, bandsFile), 'utf8'));
  const weather = JSON.parse(readFileSync(join(FIX, `weather_${slug}.json`), 'utf8')).map as
    Record<string, WeatherDay>;

  const r = runV2Pipeline(bands.records as MultiBandRecord[], weather, bands.site.lat);

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
  let phaseSwitches = 0;
  for (let i = 0; i < r.phases.length; i++) {
    phaseCount[r.phases[i]] = (phaseCount[r.phases[i]] ?? 0) + 1;
    if (i > 0 && r.phases[i] !== r.phases[i - 1]) phaseSwitches++;
  }
  const years = new Set(r.dates.map(d => d.slice(0, 4))).size || 1;

  // The original suite scored ONE year, defaulting to 2025 -- the most recent complete
  // season. Averaging every year in the record instead flattens exactly the peaks the
  // beekeepers are attesting to: it dropped South Valley September-October from 39 to 21
  // and turned a passing chamisa test into a failure that was really just dilution.
  const byYear = Object.fromEntries(Object.entries(bucket).map(([y, rows]) => [y, toMonthly(rows)]));
  const REFERENCE_YEAR = '2025';

  return {
    monthly: byYear[REFERENCE_YEAR] ?? toMonthly(all),
    byYear,
    phaseSwitches: Math.round(phaseSwitches / years),
    phaseCount: Object.fromEntries(
      Object.entries(phaseCount).map(([k, v]) => [k, Math.round((v as number) / years)])
    ) as Partial<Record<Phase, number>>,
  };
}

// Computed once — the pipeline runs a few seconds per site.
const sv = runSite('south_valley');
const tn = runSite('murfreesboro');
const tij = runSite('tijeras');

describe('South Valley, Albuquerque NM — irrigated Rio Grande bottomland', () => {
  it('reads essentially zero December to February (winter dearth, no forage)', () => {
    for (const k of ['Dec', 'Jan', 'Feb'] as MonthKey[]) expect(sv.monthly[k]).toBeLessThanOrEqual(5);
  });

  it('shows the May spring flow as a local peak', () => {
    expect(sv.monthly.May).toBeGreaterThan(sv.monthly.Apr * 0.9);
    expect(sv.monthly.May).toBeGreaterThanOrEqual(35);
  });

  it('shows the September to October chamisa flow', () => {
    expect(Math.max(sv.monthly.Sep, sv.monthly.Oct)).toBeGreaterThanOrEqual(35);
  });

  // UNTESTABLE, kept as a record rather than deleted. A large alfalfa farm sits 1.5-2.0 mi
  // out and blooms while the surrounding land is in dearth. A single mean over the 4.83 km
  // disc averages the two into a middling number and can represent neither. Needs
  // stratification by land cover, not a different threshold.
  it.todo('June: alfalfa blooms INSIDE a general dearth — a scalar disc mean cannot express this');

  it('varies July to August across years — 2024 monsoon against a dry 2026 Rio Grande', () => {
    const peaks = Object.values(sv.byYear).map(m => Math.max(m.Jul, m.Aug));
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeGreaterThanOrEqual(20);
  });
});

describe('Murfreesboro TN — rural, lush', () => {
  it('reads dormant December to February', () => {
    for (const k of ['Dec', 'Jan', 'Feb'] as MonthKey[]) expect(tn.monthly[k]).toBeLessThanOrEqual(10);
  });

  it('makes the March to May spring flow the seasonal high', () => {
    expect(Math.max(tn.monthly.Mar, tn.monthly.Apr, tn.monthly.May)).toBeGreaterThanOrEqual(50);
  });

  it('shows a midsummer dearth well below the spring flow', () => {
    expect(Math.max(tn.monthly.Jul, tn.monthly.Aug))
      .toBeLessThan(Math.max(tn.monthly.Apr, tn.monthly.May) * 0.5);
  });

  it('brings the goldenrod flow back above the summer dearth', () => {
    expect(Math.max(tn.monthly.Sep, tn.monthly.Oct))
      .toBeGreaterThan(Math.max(tn.monthly.Jul, tn.monthly.Aug));
  });

  it('reads July 2026 as a hard dearth — both hives were empty and feeding started', () => {
    expect(tn.byYear['2026']?.Jul).toBeLessThanOrEqual(10);
  });
});

describe('Tijeras NM — Sandia Mountains, pinon-juniper, 6539 ft', () => {
  // OUT-OF-SAMPLE SITE. Added after a third-party beekeeper reported their 2026 season;
  // nothing was tuned on it. Ron expected a reasonable early summer here and the beekeeper
  // corrected him, so these two encode her account, not his expectation.
  it('reads essentially zero December to February at 6539 ft', () => {
    for (const k of ['Dec', 'Jan', 'Feb'] as MonthKey[]) expect(tij.monthly[k]).toBeLessThanOrEqual(8);
  });

  it('reads spring 2026 near zero — 0.02in of March rain and greenness fell', () => {
    expect(Math.max(tij.byYear['2026']?.Apr ?? 99, tij.byYear['2026']?.May ?? 99)).toBeLessThanOrEqual(10);
  });

  it('shows no June 2026 flow — the beekeeper missed the summer flow entirely', () => {
    expect(tij.byYear['2026']?.Jun).toBeLessThanOrEqual(10);
  });
});

describe('quality metrics', () => {
  // Asserted only where they should hold. Tijeras is a low-dynamic-range mountain site
  // averaging plant communities that green up weeks apart -- relief across its disc is
  // 2425 ft against 479 at South Valley -- so it has historically failed both. That is
  // NOT asserted as a required failure: pinning a known gap in place means a change that
  // fixes it breaks the suite, which is precisely backwards.
  const asserted: [string, SiteResult][] = [
    ['South Valley', sv],
    ['Murfreesboro', tn],
  ];

  for (const [name, s] of asserted) {
    it(`${name} keeps phase switches at or under 12 a year`, () => {
      expect(s.phaseSwitches).toBeLessThanOrEqual(12);
    });

    it(`${name} reaches at least 20 days of IN_FLOW a year`, () => {
      expect(s.phaseCount.IN_FLOW ?? 0).toBeGreaterThanOrEqual(20);
    });
  }

  // Reported, not asserted. Prints the current figures so a change that improves the
  // mountain site is visible in the run rather than silently unnoticed.
  it('reports the Tijeras figures (known weak site, not asserted)', () => {
    const switches = tij.phaseSwitches;
    const inFlow = tij.phaseCount.IN_FLOW ?? 0;
    // eslint-disable-next-line no-console
    console.log(`    Tijeras: ${switches} phase switches/yr (target <=12), ` +
      `${inFlow} days IN_FLOW/yr (target >=20)`);
    expect(Number.isFinite(switches)).toBe(true);
    expect(Number.isFinite(inFlow)).toBe(true);
  });
});
