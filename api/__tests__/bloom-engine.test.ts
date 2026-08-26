import { describe, it, expect } from '@jest/globals';
import {
  computeBloomBase, openness, accumulateGdd, defaultTrigger, combineContributions,
  degreeDaysSingleSine,
  type PlantWindow, type DailyTemp,
} from '../_shared/bloom-engine';

const DAY_MS = 86_400_000;

/** Daily temperatures for whole calendar years, with an optional per-year warm offset. */
function makeTemps(years: number[], meanF: number, offsetByYear: Record<number, number> = {}): DailyTemp[] {
  const out: DailyTemp[] = [];
  for (const y of years) {
    const bump = offsetByYear[y] ?? 0;
    const start = Date.UTC(y, 0, 1);
    const end = Date.UTC(y, 11, 31);
    for (let t = start; t <= end; t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      // A plain seasonal cycle: coldest 1 January, warmest early July.
      const doy = Math.floor((t - start) / DAY_MS);
      const seasonal = -Math.cos((2 * Math.PI * doy) / 365) * 25;
      const mean = meanF + seasonal + bump;
      out.push({ date, tmax: mean + 10, tmin: mean - 10 });
    }
  }
  return out;
}

const plant = (over: Partial<PlantWindow> = {}): PlantWindow => ({
  name: 'Test Plant',
  bloomStart: '05-01',
  bloomPeak: '06-01',
  bloomEnd: '07-01',
  nectarValue: 1,
  ...over,
});

describe('openness', () => {
  it('is zero outside the window and one at the peak', () => {
    expect(openness(0, 10, 20, 30)).toBe(0);
    expect(openness(10, 10, 20, 30)).toBe(0);
    expect(openness(30, 10, 20, 30)).toBe(0);
    expect(openness(40, 10, 20, 30)).toBe(0);
    expect(openness(20, 10, 20, 30)).toBeCloseTo(1, 6);
  });

  it('rises and falls smoothly rather than linearly', () => {
    // The point of the curve: the last stretch of a bloom does not produce what the middle
    // did. A triangle would give 0.5 at the midpoint of the decline; this gives less.
    const mid = openness(25, 10, 20, 30);
    expect(mid).toBeCloseTo(0.5, 6);
    // Nearer the close, well under a straight line's 0.2.
    expect(openness(28, 10, 20, 30)).toBeLessThan(0.15);
  });

  it('handles an asymmetric window', () => {
    // Slow build, fast collapse.
    const o = openness(21, 0, 20, 24);
    expect(o).toBeGreaterThan(0.8);
    expect(openness(23, 0, 20, 24)).toBeLessThan(0.2);
  });
});

describe('degreeDaysSingleSine', () => {
  it('gives nothing when the day never reaches the base', () => {
    expect(degreeDaysSingleSine(20, 45)).toBe(0);
    expect(degreeDaysSingleSine(48, 50)).toBe(0);
  });

  it('matches the simple average when the whole day is above the base', () => {
    // No part of the curve dips below base, so there is nothing for the sine to recover.
    expect(degreeDaysSingleSine(55, 75)).toBeCloseTo(15, 6);
    expect(degreeDaysSingleSine(50, 70)).toBeCloseTo(10, 6);
  });

  it('credits a warm afternoon under a cold night', () => {
    // The real case from South Valley, 23 February 2026: reached 62.6F, fell to 29.4F.
    // Daily mean is 46.0, so the averaging method credited exactly nothing while the
    // plants sat in the sixties for hours.
    const credited = degreeDaysSingleSine(29.4, 62.6);
    expect(credited).toBeGreaterThan(0);
    expect((62.6 + 29.4) / 2).toBeLessThan(50);           // averaging method gives zero
    expect(credited).toBeLessThan(6.3);                    // and not more than half the excess
  });

  it('grows with the daytime high for a fixed overnight low', () => {
    const cool = degreeDaysSingleSine(30, 55);
    const warm = degreeDaysSingleSine(30, 70);
    const hot  = degreeDaysSingleSine(30, 85);
    expect(warm).toBeGreaterThan(cool);
    expect(hot).toBeGreaterThan(warm);
  });

  it('never returns less than the averaging method would', () => {
    // The whole point: the sine recovers heat the average discards, and never loses any.
    for (let tmin = 10; tmin <= 70; tmin += 5) {
      for (let tmax = tmin; tmax <= 100; tmax += 5) {
        const avg = Math.max(0, (tmax + tmin) / 2 - 50);
        expect(degreeDaysSingleSine(tmin, tmax)).toBeGreaterThanOrEqual(avg - 1e-9);
      }
    }
  });

  it('applies no upper cutoff — heat shutdown is a separate question', () => {
    // Development keeps accumulating in extreme heat. Whether a plant SECRETES at 105F is
    // about nectar, not about phenology, and belongs in its own term.
    expect(degreeDaysSingleSine(75, 105)).toBeCloseTo(40, 6);
  });
});

describe('accumulateGdd', () => {
  it('accumulates within a year and restarts at the turn', () => {
    const temps = makeTemps([2024, 2025], 55);
    const gdd = accumulateGdd(temps);
    expect(gdd.get('2024-01-01')!).toBeLessThan(gdd.get('2024-07-01')!);
    // The new year starts over rather than carrying the old total forward.
    expect(gdd.get('2025-01-01')!).toBeLessThan(gdd.get('2024-12-31')!);
  });

  it('adds nothing on days below the base temperature', () => {
    const cold: DailyTemp[] = [
      { date: '2025-01-01', tmax: 40, tmin: 20 },
      { date: '2025-01-02', tmax: 40, tmin: 20 },
    ];
    const gdd = accumulateGdd(cold);
    expect(gdd.get('2025-01-02')).toBe(0);
  });
});

describe('defaultTrigger', () => {
  it('treats late-season bloomers as day-length-driven', () => {
    expect(defaultTrigger('09-15')).toBe('photoperiod');
    expect(defaultTrigger('08-20')).toBe('photoperiod');
  });

  it('treats spring and early-summer bloomers as heat-driven', () => {
    expect(defaultTrigger('04-01')).toBe('gdd');
    expect(defaultTrigger('06-15')).toBe('gdd');
  });
});

describe('combineContributions', () => {
  it('gives a single plant its full value', () => {
    expect(combineContributions([0.9])).toBeCloseTo(0.9, 6);
  });

  it('sums what is open, with no positional weighting', () => {
    // The decay was removed on instruction: rank in a sorted list is not a property of a
    // plant. The cost is that overlapping months outscore single-dominant-flow months.
    expect(combineContributions([0.9, 0.8, 0.4])).toBeCloseTo(2.1, 6);
  });

  it('sorts, so caller order cannot change the answer', () => {
    expect(combineContributions([0.4, 0.9, 0.8])).toBeCloseTo(combineContributions([0.9, 0.8, 0.4]), 9);
  });

  // KNOWN AND ACCEPTED SHORTFALL, recorded so it cannot be forgotten.
  //
  // Real 22g contributions: mid-June has five species overlapping, mid-September has
  // chamisa essentially alone. A plain sum scores June at about 2.8x September; the
  // beekeeper reports the real ratio is about 1.5x. Under absolute phase thresholds this
  // would label a genuine autumn flow a dearth.
  //
  // The positional decay that corrected the ratio was removed on instruction, because rank
  // in a sorted list is not a property of a plant. The intended fix is honest per-zone
  // significance ratings: the current seed rates six of ten plants between 0.5 and 0.9,
  // which is what lets minor species inflate June. Ratings alone were measured to move this
  // from 2.8x to 2.1x, so they narrow the gap without closing it.
  //
  // When ratings land, re-measure. If the ratio is still far above 1.5x, this is unresolved.
  it('overstates a diverse month against a single dominant flow (known shortfall)', () => {
    const june = combineContributions([0.90, 0.70, 0.64, 0.47, 0.09]);
    const september = combineContributions([0.90, 0.11]);
    expect(june / september).toBeGreaterThan(2.5);
  });

  it('is zero when nothing is open', () => {
    expect(combineContributions([])).toBe(0);
  });
});

describe('computeBloomBase', () => {
  const peakDoyOfYear = (r: ReturnType<typeof computeBloomBase>, year: string) => {
    let best = -1, bestIdx = -1;
    r.dates.forEach((d, i) => {
      if (!d.startsWith(year)) return;
      if (r.potential[i] > best) { best = r.potential[i]; bestIdx = i; }
    });
    const d = r.dates[bestIdx];
    const [y, m, dd] = d.split('-').map(Number);
    return Math.floor((Date.UTC(y, m - 1, dd) - Date.UTC(y, 0, 0)) / DAY_MS);
  };

  it('opens a heat-driven plant EARLIER in an unusually warm year', () => {
    // Three normal years set the threshold; the fourth runs 12F hot.
    const temps = makeTemps([2022, 2023, 2024, 2025], 55, { 2025: 12 });
    const r = computeBloomBase([plant({ trigger: 'gdd' })], temps);
    const normal = peakDoyOfYear(r, 2024 + '');
    const hot = peakDoyOfYear(r, '2025');
    expect(hot).toBeLessThan(normal);
    // A 12F summer-long anomaly should be worth weeks, not a day or two.
    expect(normal - hot).toBeGreaterThan(7);
  });

  it('does NOT move a day-length-driven plant in the same warm year', () => {
    // This is the distinction that matters. Chamisa and goldenrod are short-day plants;
    // shifting them by accumulated heat makes them more wrong in an anomalous year.
    const temps = makeTemps([2022, 2023, 2024, 2025], 55, { 2025: 12 });
    const fall = plant({ bloomStart: '08-15', bloomPeak: '09-15', bloomEnd: '10-31' });
    const r = computeBloomBase([fall], temps);
    expect(r.thresholds[0].trigger).toBe('photoperiod');
    expect(peakDoyOfYear(r, '2025')).toBe(peakDoyOfYear(r, '2024'));
  });

  it('adds overlapping plants together, so two open beats one', () => {
    const temps = makeTemps([2024, 2025], 55);
    const one = computeBloomBase([plant({ name: 'A' })], temps);
    const two = computeBloomBase(
      [plant({ name: 'A' }), plant({ name: 'B', bloomStart: '05-10', bloomPeak: '06-01', bloomEnd: '06-25' })],
      temps
    );
    const idx = one.dates.indexOf('2025-06-01');
    expect(two.potential[idx]).toBeGreaterThan(one.potential[idx]);
  });

  it('scales a plant by its nectar value', () => {
    const temps = makeTemps([2024, 2025], 55);
    const rich = computeBloomBase([plant({ nectarValue: 0.9 })], temps);
    const poor = computeBloomBase([plant({ nectarValue: 0.3 })], temps);
    const i = rich.dates.indexOf('2025-06-01');
    expect(rich.potential[i]).toBeGreaterThan(poor.potential[i]);
  });

  it('reports days the plant list cannot account for', () => {
    // One plant covering two months leaves the rest of the year empty. That is a hole in
    // the research, and it must be visible rather than reported as a dearth.
    const temps = makeTemps([2024, 2025], 55);
    const r = computeBloomBase([plant()], temps);
    expect(r.emptyDays).toBeGreaterThan(250);
  });

  it('breaks the latest day down by plant', () => {
    const temps = makeTemps([2024, 2025], 55);
    // End the record inside a known bloom so something is actually open.
    const trimmed = temps.filter(t => t.date <= '2025-06-01');
    const r = computeBloomBase([plant({ name: 'Alfalfa' })], trimmed);
    expect(r.latestBreakdown.length).toBe(1);
    expect(r.latestBreakdown[0].name).toBe('Alfalfa');
    expect(r.latestBreakdown[0].openness).toBeGreaterThan(0.5);
  });

  it('returns empty rather than throwing on no plants or no weather', () => {
    expect(computeBloomBase([], makeTemps([2025], 55)).dates).toEqual([]);
    expect(computeBloomBase([plant()], []).dates).toEqual([]);
  });
});
