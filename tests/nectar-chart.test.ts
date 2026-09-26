// Chart maths vs the transcribed chart answer files (GOLDEN-OUTPUTS §1 `.chart.json`, §4 season).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChartModel, chartDayOfYear } from '../shared/nectar/chart';

const G = join(__dirname, 'golden');
const json = (p: string) => JSON.parse(readFileSync(join(G, p), 'utf8'));
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('nectar chart model', () => {
  for (const dir of ['nectar', 'nectar-live']) {
    for (const file of readdirSync(join(G, dir)).filter(f => f.endsWith('.chart.json'))) {
      it(`${dir}/${file}`, () => {
        const want = json(`${dir}/${file}`);
        const history = json(`${dir}/${file.replace('.chart.json', '.response.json')}`).full_history;
        const m = buildChartModel(history)!;

        expect(m.currentYear).toBe(want.currentYear);
        expect(m.baseYearLabel).toBe(want.baseYearLabel);
        expect(m.yAxisMax).toBe(want.yAxisMax);
        expect(m.differenceSpan).toBe(want.differenceAxisSpan);
        expect(m.seasonToDateSpan).toBe(want.seasonToDateAxisSpan);
        expect(m.seasonToDate).toBe(want.seasonToDate);
        expect(m.seasonToDateCaption).toBe(want.seasonToDateCaption);

        const normals = want.normalByDayOfYear.filter((n: { samples: number }) => n.samples > 0);
        expect(m.normal.size).toBe(normals.length);
        for (const n of normals) {
          expect(m.normal.get(n.day)?.samples).toBe(n.samples);
          close(m.normal.get(n.day)!.normal, n.normal);
        }

        expect(m.difference.length).toBe(want.currentYearDaily.length);
        want.currentYearDaily.forEach((w: Record<string, number | string>, i: number) => {
          const g = m.difference[i];
          expect(g.date).toBe(w.date);
          expect(g.day).toBe(w.day);
          close(g.current, w.current as number);
          close(g.normal, w.normal as number);
          close(g.difference, w.difference as number);
          close(g.seasonToDate, w.seasonToDate as number);
        });
      });
    }
  }

  it('chart day of year edge dates (DST, leap year)', () => {
    for (const c of json('season/season-helpers.json').chartDayOfYear) {
      expect(chartDayOfYear(c.date), c.date).toBe(c.chartDayOfYear);
    }
  });
});
