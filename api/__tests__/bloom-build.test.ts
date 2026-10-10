// The stored apiary_bloom form (api/_bloom/build.ts) must carry the Bloom workshop's dates unchanged:
// replaying the parity fixtures, each plant's month-day start and end match the scripts' table.

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildApiaryBloom, inBloomCoverage } from '../_bloom/build';

const DIR = join(__dirname, 'fixtures', 'bloom');

describe('stored bloom table', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
    it(`${file}: same plants and month-day dates as the scripts`, async () => {
      const fx = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
      const getJson = async (url: string) => {
        if (!(url in fx.responses)) throw new Error(`No recorded answer for ${url}`);
        return JSON.parse(JSON.stringify(fx.responses[url]));
      };
      const built = await buildApiaryBloom(fx.lat, fx.lon, getJson);
      const t = fx.expectedTable;
      expect(built).toMatchObject({ built_lat: fx.lat, built_lon: fx.lon, radius_mi: t.radiusMi, limited: t.limited, warning: t.warning, normal_years: t.normalYears, normal_heat_year_end: t.normalHeatYearEnd });
      expect(built.plants).toEqual(
        t.plants.map((r: any) => ({ plant: r.plant, presence: r.presence, trigger: r.trigger, start: r.start ? r.start.slice(5) : null, end: r.end ? r.end.slice(5) : null, note: r.note }))
      );
    });
  }

  it('covers North America only', () => {
    expect(inBloomCoverage(35.08, -106.65)).toBe(true); // Albuquerque
    expect(inBloomCoverage(35.8, -86.37)).toBe(true); // middle Tennessee
    expect(inBloomCoverage(61.2, -149.9)).toBe(true); // Anchorage
    expect(inBloomCoverage(54.69, 25.28)).toBe(false); // Vilnius
  });
});
