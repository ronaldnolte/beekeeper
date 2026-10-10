// The app's bloom calculation must give exactly what Ron's Bloom workshop scripts give (E:\Bloom
// apiaryForage.mjs + apiaryTable.mjs). The fixtures hold the GBIF and Daymet answers recorded while those
// scripts ran unchanged on 2026-10-08, plus the scripts' outputs; here the app's port is fed the same
// answers and must reproduce the outputs field for field. Any request the port makes that the scripts did
// not make fails the test too (it has no recorded answer).

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findNearbyPlants } from '../_bloom/presence';
import { buildBloomTable, normalHeat } from '../_bloom/table';
import { FORAGE_MASTER } from '../_bloom/forageMaster';

const DIR = join(__dirname, 'fixtures', 'bloom');
const sites = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('bloom calculation matches the Bloom workshop scripts', () => {
  it('has fixtures for the three apiaries', () => {
    expect(sites.length).toBe(3);
  });

  for (const file of sites) {
    const fx = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    const asked: string[] = [];
    const getJson = async (url: string) => {
      asked.push(url);
      if (!(url in fx.responses)) throw new Error(`No recorded answer for ${url}`);
      return JSON.parse(JSON.stringify(fx.responses[url]));
    };

    it(`${file}: same plants, presence, dates and statuses`, async () => {
      const site = await findNearbyPlants(fx.lat, fx.lon, FORAGE_MASTER.plants, getJson);
      expect(site).toEqual(fx.expectedPresence);

      const heat = await normalHeat(fx.lat, fx.lon, Array.from({ length: 10 }, (_, i) => 2016 + i), getJson);
      const table = buildBloomTable(fx.lat, fx.lon, site, FORAGE_MASTER.plants, heat, new Date(fx.asOf + 'T00:00:00Z'));
      expect(table).toEqual(fx.expectedTable);

      // Every recorded answer was asked for: the port makes the same requests as the scripts.
      expect(new Set(asked)).toEqual(new Set(Object.keys(fx.responses)));
    });
  }
});
