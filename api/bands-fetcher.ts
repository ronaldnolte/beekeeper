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
//  - Every date reports the fraction of the forage disc that had usable pixels. This is a
//    WEIGHT, not a gate: the engine weights each observation by its coverage, so a
//    half-clouded scene still contributes but at half the pull of a clear one. Only
//    genuinely useless scenes (below `minCoverage`) are discarded outright — a 92%-clouded
//    scene is the mean of a biased 8% corner of the disc.
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
  /** Mean forage weight across the disc: how much of it can produce nectar at all. */
  forageFraction: number;
}

// Per-land-cover forage weight, applied as a per-pixel reducer weight (ESA WorldCover
// v200 classes). Measured at Ron's South Valley apiary, the 4.83 km disc is 52% built-up,
// 18% bare and 2.9% cropland — so the unweighted mean tracked the built-up trace almost
// exactly (flat 0.16-0.21 all season) while the cropland stratum, carrying the alfalfa
// he actually forages, swung 0.40-0.61 and was averaged into nothing.
//
// These are PRIORS, not measurements. Tree cover is the least certain: at Murfreesboro it
// is deciduous forest full of tulip poplar and black locust, at Tijeras it is evergreen
// pinon-juniper that produces almost nothing. Built-up keeps a small non-zero weight
// because suburban gardens are real forage we cannot resolve at 10 m.
export const FORAGE_WEIGHTS: Record<number, number> = {
  10: 0.6,  // tree cover
  20: 0.8,  // shrubland
  30: 1.0,  // grassland
  40: 1.0,  // cropland
  50: 0.1,  // built-up
  60: 0.0,  // bare / sparse vegetation
  70: 0.0,  // snow and ice
  80: 0.0,  // permanent water
  90: 0.8,  // herbaceous wetland
  95: 0.0,  // mangroves
  100: 0.0, // moss and lichen
};

function forageWeightImage(): any {
  const from = Object.keys(FORAGE_WEIGHTS).map(Number);
  const to = from.map(k => FORAGE_WEIGHTS[k]);
  return ee.ImageCollection('ESA/WorldCover/v200').first().remap(from, to, 0).rename('forage');
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

/** Floor below which a date is discarded outright. Above it, coverage is used as a
 *  weight by the engine rather than as a pass/fail gate — a hard 0.6 cut cost
 *  Murfreesboro two thirds of its observations (372 dates -> 111, about one usable
 *  pass every 12 days against a 24-day rate window). */
export const MIN_COVERAGE = 0.2;

export async function fetchMultiBandsDetailed(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  radiusKm = 4.83, // ~3 mile bee forage radius; averages the colony's true foraging range
  minCoverage = MIN_COVERAGE,
  // The whole disc is averaged into one number, so a finer reduce buys nothing. Measured
  // over 3.6 years at South Valley: 20 m took 41.3 s, 60 m took 19.6 s, and the NDVI
  // series differed by a mean of 0.0037 (max 0.0088).
  scaleM = 60,
  /** Weight each pixel by the forage value of its land cover (see FORAGE_WEIGHTS). */
  forageWeighted = true
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

  const forage = forageWeightImage();

  const processed = ee.ImageCollection(perDate).map((mScl: any) => {
    // A fractional mask acts as a per-pixel weight in Earth Engine reducers, so the
    // land-cover weighting costs nothing extra: it rides the reduce we already do.
    const m = forageWeighted ? mScl.updateMask(forage) : mScl;
    // Ratio-based indices — scale-invariant, use raw DN
    const ndvi = m.normalizedDifference(['B8', 'B4']).rename('ndvi');
    const ndwi = m.normalizedDifference(['B8', 'B11']).rename('ndwi');
    // EVI requires reflectance scaling before the non-linear formula
    const nir  = m.select('B8').multiply(0.0001);
    const red  = m.select('B4').multiply(0.0001);
    const blue = m.select('B2').multiply(0.0001);
    const eviRaw = nir.subtract(red).multiply(2.5)
      .divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1))
      .rename('evi');
    // EVI's denominator (nir + 6*red - 7.5*blue + 1) can collapse toward zero over dark
    // or anomalous pixels, and a single such pixel destroys the regional mean — observed
    // at South Valley on 2025-11-06: evi = 1.12e9. Physically valid EVI lies within
    // [-1, 1]; anything outside that is a numerical artifact, so drop those pixels.
    const evi = eviRaw.updateMask(eviRaw.gte(-1).and(eviRaw.lte(1)));
    // Coverage stays on the SCL mask alone — it measures cloud/quality, not forage,
    // and conflating the two would make a city look permanently overcast.
    const coverage = mScl.select('B8').mask().unmask(0).rename('coverage');

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

  // Static per location, so precision does not matter: reduce it at a coarse scale to keep
  // this second round-trip cheap. (Bundling it into the per-date evaluate via ee.Dictionary
  // was tried and silently returned no features.)
  const ffResult: any = await evaluate(forage.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: geom, scale: 100, maxPixels: 1e9, bestEffort: true }));
  const forageFraction = Math.round(((ffResult?.forage as number) ?? 0) * 1000) / 1000;

  const fc = await evaluate(processed);
  if (!fc?.features) return { records: [], droppedLowCoverage: 0, forageFraction };

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

  return { records, droppedLowCoverage: all.length - records.length, forageFraction };
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
