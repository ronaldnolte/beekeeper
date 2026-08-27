import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKS, summarise, REFERENCE_YEAR, type SiteResult } from './groundTruth';
import type { MultiBandRecord } from '../_shared/bands-fetcher';
import type { WeatherDay } from '../_shared/weather';

// Ground truth from beekeepers who were physically present, run against the real shipped
// engine on real cached satellite and weather records.
//
// The checks themselves live in ./groundTruth.ts so the fetcher experiments score against
// exactly the same definitions. If a setting change is measured as better, it is better by
// the same bar these tests enforce — not a second, friendlier one.
//
// Fixtures are cached Earth Engine and Open-Meteo responses, checked in deliberately: tests
// must not depend on a network call, a paid API, or on today's date.

const FIX = join(__dirname, 'fixtures');

function load(slug: string): SiteResult {
  const bands = JSON.parse(readFileSync(join(FIX, `bands_${slug}.json`), 'utf8'));
  const weather = JSON.parse(readFileSync(join(FIX, `weather_${slug}.json`), 'utf8')).map as
    Record<string, WeatherDay>;
  return summarise(bands.records as MultiBandRecord[], weather, bands.site.lat);
}

const sites: Record<string, SiteResult> = {
  south_valley: load('south_valley'),
  murfreesboro: load('murfreesboro'),
  tijeras: load('tijeras'),
};

const LABEL: Record<string, string> = {
  south_valley: 'South Valley, Albuquerque NM — irrigated Rio Grande bottomland',
  murfreesboro: 'Murfreesboro TN — rural, lush',
  tijeras: 'Tijeras NM — Sandia Mountains, pinon-juniper, 6539 ft',
};

for (const slug of Object.keys(sites)) {
  describe(LABEL[slug], () => {
    const asserted = CHECKS.filter(c => c.site === slug && !c.advisory);
    const advisory = CHECKS.filter(c => c.site === slug && c.advisory);

    for (const check of asserted) {
      it(`${check.id}: ${check.desc}`, () => {
        expect(check.run(sites[slug])).toBe(true);
      });
    }

    for (const check of advisory) {
      // Reported, not asserted. Pinning a known gap in place means a change that FIXES it
      // breaks the suite, which is precisely backwards.
      it(`${check.id} (advisory, not asserted)`, () => {
        const passing = check.run(sites[slug]);
        // eslint-disable-next-line no-console
        console.log(`    ${check.id}: ${passing ? 'passing' : 'still short'} — ${check.desc}`);
        expect(typeof passing).toBe('boolean');
      });
    }
  });
}

describe('ground truth suite', () => {
  it(`scores the ${REFERENCE_YEAR} reference year across three sites`, () => {
    const asserted = CHECKS.filter(c => !c.advisory);
    const passing = asserted.filter(c => c.run(sites[c.site])).length;
    // eslint-disable-next-line no-console
    console.log(`    ${passing} of ${asserted.length} asserted checks passing`);
    expect(passing).toBe(asserted.length);
  });

  // UNTESTABLE, kept as a record rather than deleted. A large alfalfa farm sits 1.5-2.0 mi
  // from the South Valley apiary and blooms while the surrounding land is in dearth. A
  // single mean over the 4.83 km disc averages the two into a middling number and can
  // represent neither. Needs stratification by land cover, not a different threshold.
  it.todo('sv-june-alfalfa: alfalfa blooms INSIDE a dearth — a scalar disc mean cannot express it');
});
