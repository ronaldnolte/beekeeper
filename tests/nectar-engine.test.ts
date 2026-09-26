// Holds the nectar engine to the answer key (GOLDEN-OUTPUTS §1, §2, §7). Tolerances are the
// spec's: daily smoothed index within 1e-9; phase, NFI, 3-dp history and monthly tables exact.
// The ground-truth pass/fail "checks" are informational only and are deliberately not tested.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runEngine, summarise, nextPass, type BandRecord, type WeatherDay } from '../shared/nectar/engine';
import { trailingSlope } from '../shared/nectar/math';

const G = join(__dirname, 'golden');
const json = (p: string) => JSON.parse(readFileSync(join(G, p), 'utf8'));

function csv(p: string) {
  const [head, ...rows] = readFileSync(join(G, p), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map(r => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])) as Record<string, string>);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthlyByYear(dates: string[], idx: number[]) {
  const bucket: Record<string, number[][]> = {};
  dates.forEach((d, i) => (bucket[d.slice(0, 4)] ??= MONTHS.map(() => []))[+d.slice(5, 7) - 1].push(idx[i] * 100));
  const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return Object.fromEntries(
    Object.entries(bucket).map(([y, rows]) => [y, Object.fromEntries(MONTHS.map((m, i) => [m, mean(rows[i])]))]),
  );
}

interface Run {
  site: string;
  variant: string;
  windowEnd: string;
}

function check(dir: 'nectar' | 'nectar-live', fixtureDir: 'fixtures' | 'fixtures-live', run: Run) {
  const bands = json(`${fixtureDir}/bands_${run.site}.json`);
  const weather = json(`${fixtureDir}/weather_${run.site}.json`).map as Record<string, WeatherDay>;
  const base = `${dir}/${run.site}.${run.variant}`;
  const r = runEngine(bands.records as BandRecord[], weather, bands.site.lat, { windowEnd: run.windowEnd })!;
  expect(r).not.toBeNull();

  // Daily series
  const series = csv(`${base}.series.csv`);
  expect(r.dates.length).toBe(series.length);
  series.forEach((row, i) => {
    expect(r.dates[i], `date ${i}`).toBe(row.date);
    expect(Math.abs(r.idx[i] - +row.index_smoothed_full_precision), `index ${row.date}`).toBeLessThan(1e-9);
    expect(r.phases[i], `phase ${row.date}`).toBe(row.phase);
    expect(Math.round(100 * r.idx[i]), `nfi ${row.date}`).toBe(+row.nfi);
    expect(Math.abs(r.slope[i] - +row.slope), `slope ${row.date}`).toBeLessThan(1e-9);
  });

  // API body (minus live-only parts)
  const want = json(`${base}.response.json`);
  const got = summarise(r);
  expect(Math.abs(got.slope - want.slope)).toBeLessThan(1e-9);
  expect({ ...got, slope: 0 }).toEqual({
    nfi: want.nfi,
    phase: want.phase,
    status: want.status,
    trend_direction: want.trend_direction,
    slope: 0,
    v2: want.v2,
    full_history: want.full_history,
  });

  // Monthly tables
  expect(monthlyByYear(r.dates, r.idx)).toEqual(json(`${base}.summary.json`).groundTruth.byYear);

  // Satellite block (live key only)
  if (want.satellite) {
    const passes: string[] = bands.passDates;
    expect({
      last_pass: passes[passes.length - 1],
      last_image: bands.records[bands.records.length - 1].date,
      next_pass: nextPass(passes),
      pass_count: passes.length,
      image_count: bands.records.length,
    }).toEqual(want.satellite);
  }
}

describe('nectar engine vs experimental-fetcher fixtures (golden/nectar)', () => {
  for (const run of json('nectar/INDEX.json') as Run[]) {
    it(`${run.site} ${run.variant}`, () => check('nectar', 'fixtures', run));
  }
});

describe('nectar engine vs live-fetcher fixtures (golden/nectar-live)', () => {
  for (const run of json('nectar-live/INDEX.json') as Run[]) {
    it(`${run.site} ${run.variant}`, () => check('nectar-live', 'fixtures-live', run));
  }
});

describe('synthetic cases (golden/synthetic)', () => {
  for (const name of ['spring-season-warm', 'spring-season-cold', 'wet-then-dry', 'autumn-humid-flat', 'sine-wobble']) {
    it(name, () => {
      const input = json(`synthetic/${name}.input.json`);
      const r = runEngine(input.records, input.weather, input.lat, { windowEnd: input.windowEnd })!;
      const series = csv(`synthetic/${name}.series.csv`);
      expect(r.dates.length).toBe(series.length);
      series.forEach((row, i) => {
        expect(r.dates[i]).toBe(row.date);
        expect(Math.abs(r.idx[i] - +row.index_smoothed_full_precision), `index ${row.date}`).toBeLessThan(1e-9);
        expect(r.phases[i], `phase ${row.date}`).toBe(row.phase);
        expect(Math.abs(r.slope[i] - +row.slope), `slope ${row.date}`).toBeLessThan(1e-9);
      });
      expect(summarise(r).v2).toEqual(json(`synthetic/${name}.latest.json`));
    });
  }

  it('trailing slope estimator', () => {
    for (const c of json('synthetic/trailing-slope.json') as { y: number[]; i: number; win: number; slope: number }[]) {
      expect(Math.abs(trailingSlope(c.y, c.i, c.win) - c.slope)).toBeLessThan(1e-12);
    }
  });
});
