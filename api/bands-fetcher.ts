// Fetches per-date NDVI + EVI + NDWI from Sentinel-2 via Earth Engine.
// EVI is NOT ratio-invariant — bands are scaled to reflectance (×0.0001) before the formula.
//
// Quality rules (added 2026-08-19, Phase 1 hardening):
//  - SCL mask keeps ONLY vegetation (4) and bare/not-vegetated (5). Everything else is
//    dropped, including water (6) — water carries strongly negative NDVI and was
//    contaminating the percentile baseline (a Nashville baseline of -0.2587 was a water pixel).
//  - Same-date granules are MOSAICKED before reducing. Sentinel-2 tiles are 110 km, so a
//    ~9.7 km disc near a tile boundary previously produced two same-date records, each a
//    partial-area mean. Measured at South Valley: 33 duplicate dates, same-day NDVI
//    disagreeing by up to 0.100 — roughly 40% of that site's entire dynamic range.
//  - Every date reports the fraction of the forage disc that had usable pixels. Scenes below
//    `minCoverage` are dropped: a 92%-clouded scene otherwise returned the mean of the
//    surviving 8% (a biased corner sample) weighted exactly like a clear scene.
// @ts-ignore
import { XMLHttpRequest } from 'xmlhttprequest';
if (typeof global !== 'undefined' && !(global as any).XMLHttpRequest) {
  (global as any).XMLHttpRequest = XMLHttpRequest;
}
// @ts-ignore
import ee from '@google/earthengine';

export interface MultiBandRecord {
  date: string;
  ndvi: number;
  evi: number;
  ndwi: number;
  /** Fraction of the forage disc with usable (unmasked) pixels on this date, 0–1.
   *  Optional so synthetic/test series need not fabricate it — the engine does not read it. */
  coverage?: number;
}

export interface FetchBandsResult {
  records: MultiBandRecord[];
  /** Dates returned by Earth Engine but rejected for insufficient usable area. */
  droppedLowCoverage: number;
}

let isEEInitialized = false;

function initEarthEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isEEInitialized) return resolve();
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) return reject(new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing.'));
    try {
      const credentials = JSON.parse(keyString);
      ee.data.authenticateViaPrivateKey(
        credentials,
        () => ee.initialize(null, null,
          () => { isEEInitialized = true; resolve(); },
          (err: any) => reject(new Error(`EE init failed: ${err}`))
        ),
        (err: any) => reject(new Error(`EE auth failed: ${err}`))
      );
    } catch (e: any) {
      reject(new Error(`Failed to parse GEE credentials: ${e.message}`));
    }
  });
}

function evaluate(expr: any): Promise<any> {
  return new Promise((resolve, reject) => {
    expr.evaluate((result: any, error: any) =>
      error ? reject(new Error(error)) : resolve(result)
    );
  });
}

/** Minimum fraction of the forage disc that must have usable pixels for a date to count. */
export const MIN_COVERAGE = 0.6;

export async function fetchMultiBandsDetailed(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  radiusKm = 4.83, // ~3 mile bee forage radius; averages the colony's true foraging range
  minCoverage = MIN_COVERAGE,
  scaleM = 20
): Promise<FetchBandsResult> {
  await initEarthEngine();

  const geom = ee.Geometry.Point([lon, lat]).buffer(radiusKm * 1000);
  const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom)
    .filterDate(startDate, endDate)
    // Tile-level prefilter: pure latency trim. The real quality gate is `coverage`
    // below, computed over our own disc — a mostly-cloudy 110 km tile can still be
    // clear over a 9.7 km circle, so this stays deliberately loose.
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 95));

  // Mask BEFORE mosaicking so a cloud in one granule lets an overlapping granule
  // show through instead of winning the pixel.
  const masked = col.map((image: any) => {
    const scl = image.select('SCL');
    const keep = scl.eq(4).or(scl.eq(5)); // vegetation + bare ground only
    return image.updateMask(keep).set('dstamp', image.date().format('YYYY-MM-dd'));
  });

  // One image per calendar date: join all granules sharing a dstamp, then mosaic.
  const perDate = ee.ImageCollection(
    ee.Join.saveAll('sameDay').apply(
      masked.distinct('dstamp'),
      masked,
      ee.Filter.equals({ leftField: 'dstamp', rightField: 'dstamp' })
    )
  ).map((img: any) =>
    ee.ImageCollection(ee.List(img.get('sameDay'))).mosaic().set('dstamp', img.get('dstamp'))
  );

  const processed = ee.ImageCollection(perDate).map((m: any) => {
    // Ratio-based indices — scale-invariant, use raw DN
    const ndvi = m.normalizedDifference(['B8', 'B4']).rename('ndvi');
    const ndwi = m.normalizedDifference(['B8', 'B11']).rename('ndwi');
    // EVI requires reflectance scaling before the non-linear formula
    const nir  = m.select('B8').multiply(0.0001);
    const red  = m.select('B4').multiply(0.0001);
    const blue = m.select('B2').multiply(0.0001);
    const evi  = nir.subtract(red).multiply(2.5)
      .divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1))
      .rename('evi');
    // 1 where a usable pixel survived the mask, 0 elsewhere — mean over the disc
    // is the usable-area fraction.
    const coverage = m.select('B8').mask().unmask(0).rename('coverage');

    const stack = ndvi.addBands(evi).addBands(ndwi).addBands(coverage);
    const means = stack.reduceRegion({
      reducer: ee.Reducer.mean(), geometry: geom, scale: scaleM, maxPixels: 1e9
    });
    return ee.Feature(null, {
      date: m.get('dstamp'),
      ndvi: means.get('ndvi'),
      evi:  means.get('evi'),
      ndwi: means.get('ndwi'),
      coverage: means.get('coverage'),
    });
  }).filter(ee.Filter.notNull(['ndvi', 'evi', 'ndwi']));

  const fc = await evaluate(processed);
  if (!fc?.features) return { records: [], droppedLowCoverage: 0 };

  const all = (fc.features as any[]).map(f => ({
    date: f.properties.date as string,
    ndvi: f.properties.ndvi as number,
    evi:  f.properties.evi as number,
    ndwi: f.properties.ndwi as number,
    coverage: (f.properties.coverage as number) ?? 0,
  }));

  const records = all
    .filter(r => r.coverage >= minCoverage)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { records, droppedLowCoverage: all.length - records.length };
}

/** Back-compat wrapper — existing callers just want the records. */
export async function fetchMultiBands(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  radiusKm = 4.83
): Promise<MultiBandRecord[]> {
  const { records } = await fetchMultiBandsDetailed(lat, lon, startDate, endDate, radiusKm);
  return records;
}
