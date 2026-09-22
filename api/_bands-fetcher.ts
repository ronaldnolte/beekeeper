// Fetches per-scene NDVI + EVI + NDWI from Sentinel-2 via Earth Engine.
// EVI is NOT ratio-invariant — bands are scaled to reflectance (×0.0001) before the formula.
// @ts-ignore
import { XMLHttpRequest } from 'xmlhttprequest';
if (typeof global !== 'undefined' && !(global as any).XMLHttpRequest) {
  (global as any).XMLHttpRequest = XMLHttpRequest;
}
// @ts-ignore
import ee from '@google/earthengine';

/**
 * What one fetch returns.
 *
 * `records` are the scenes that yielded usable numbers. `passDates` is every
 * date the satellite flew over this yard, cloudy or not — the two differ by
 * exactly the days the sky was in the way, which is what lets the chart say
 * "the satellite looked, it just couldn't see" instead of going quiet.
 */
export interface MultiBandFetch {
  records: MultiBandRecord[];
  passDates: string[];
}

export interface MultiBandRecord {
  date: string;
  ndvi: number;
  evi: number;
  ndwi: number;
}

/**
 * The MGRS tile names that could plausibly cover a point — its own UTM zone and
 * latitude band, plus one of each either side.
 *
 * Sentinel-2 tile names read like `13SCU`: zone 13, band S, then the 100km
 * square. Zones are 6 degrees of longitude, bands 8 degrees of latitude from
 * 80S. Tiles overlap their neighbours by about 10km, so a yard near a boundary
 * is genuinely imaged from the next zone or band along — hence the margin of
 * one in each direction, which is nine prefixes. Two zones away is not a
 * real tile, it is a corrupt row.
 *
 * Zones wrap at the antimeridian (60 -> 1); bands do not (they stop at the
 * poles).
 */
function mgrsPrefixes(lat: number, lon: number): string[] {
  const BANDS = 'CDEFGHJKLMNPQRSTUVWX'; // no I or O — too like 1 and 0
  const zone = Math.floor((lon + 180) / 6) + 1;
  const band = Math.floor((lat + 80) / 8);
  const zones = [zone - 1, zone, zone + 1].map(z => ((z - 1 + 60) % 60) + 1);
  const bands = [band - 1, band, band + 1].filter(b => b >= 0 && b < BANDS.length);
  const out: string[] = [];
  for (const z of zones) for (const b of bands) out.push(`${z}${BANDS[b]}`);
  return out;
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

export async function fetchMultiBands(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  radiusKm = 4.83 // ~3 mile bee forage radius (was 1.6km); averages the colony's true foraging range
): Promise<MultiBandFetch> {
  await initEarthEngine();

  const geom = ee.Geometry.Point([lon, lat]).buffer(radiusKm * 1000);
  const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom)
    .filterDate(startDate, endDate)
    // Keep only scenes from a tile that could actually be overhead.
    //
    // WHY THIS EXISTS. On 2026-09-21 a scene appeared in the catalogue —
    // 20260921T081631_20260921T082016_T39WXT, an Arctic tile off Novaya Zemlya
    // — declaring a footprint of 2^63 km², which evaluates to Infinity: an
    // overflow, not a measurement. A footprint that size intersects every point
    // on Earth, so filterBounds handed it to every yard we look at, and
    // reduceRegion then had to express a New Mexico circle in that scene's UTM
    // zone 39 grid. Reprojected 155 degrees of longitude away, the circle
    // smeared across 1.4 billion pixels and blew the maxPixels ceiling. One bad
    // row in Google's catalogue took every nectar report on Earth down.
    //
    // WHY BY TILE NAME. The first version of this guard measured each scene's
    // area and dropped anything absurd. Correct, and too slow: it put a
    // geometry computation on all ~900 scenes in the five-year window, and this
    // request already runs close to the client's 60-second patience. MGRS_TILE
    // is metadata that is already sitting there, so this costs nothing.
    .filter(ee.Filter.or(
      ...mgrsPrefixes(lat, lon).map(p => ee.Filter.stringStartsWith('MGRS_TILE', p))
    ));

  const processed = col.map((image: any) => {
    const dateStr = image.date().format('YYYY-MM-dd');
    const scl = image.select('SCL');
    const mask = scl.neq(3).and(scl.neq(7)).and(scl.neq(8))
      .and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
    const m = image.updateMask(mask);

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

    const stack = ndvi.addBands(evi).addBands(ndwi);
    const means = stack.reduceRegion({
      reducer: ee.Reducer.mean(), geometry: geom, scale: 20, maxPixels: 1e9
    });
    return ee.Feature(null, {
      date: dateStr,
      ndvi: means.get('ndvi'),
      evi:  means.get('evi'),
      ndwi: means.get('ndwi'),
    });
  });
  // NOTE: the null filter used to live here, on the server side. It now runs in
  // JS below so we keep BOTH lists: every date the satellite passed over, and
  // the subset that produced usable numbers. The difference between the two is
  // cloud — and a beekeeper looking at a flat line deserves to know which of the
  // two he is seeing.

  const fc = await evaluate(processed);
  if (!fc?.features) return { records: [], passDates: [] };

  const all = (fc.features as any[])
    .map(f => ({
      date: f.properties.date as string,
      ndvi: f.properties.ndvi as number | null,
      evi:  f.properties.evi as number | null,
      ndwi: f.properties.ndwi as number | null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Every pass, cloudy or not. Duplicates happen where two orbit swaths overlap
  // the same yard on one day.
  const passDates = Array.from(new Set(all.map(r => r.date)));

  const records = all.filter(
    (r): r is MultiBandRecord =>
      r.ndvi !== null && r.evi !== null && r.ndwi !== null
  );

  return { records, passDates };
}
