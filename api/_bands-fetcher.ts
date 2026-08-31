// Fetches per-scene NDVI + EVI + NDWI from Sentinel-2 via Earth Engine.
// EVI is NOT ratio-invariant — bands are scaled to reflectance (×0.0001) before the formula.
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
): Promise<MultiBandRecord[]> {
  await initEarthEngine();

  const geom = ee.Geometry.Point([lon, lat]).buffer(radiusKm * 1000);
  const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom)
    .filterDate(startDate, endDate);

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
  }).filter(ee.Filter.notNull(['ndvi', 'evi', 'ndwi']));

  const fc = await evaluate(processed);
  if (!fc?.features) return [];

  return (fc.features as any[])
    .map(f => ({
      date: f.properties.date as string,
      ndvi: f.properties.ndvi as number,
      evi:  f.properties.evi as number,
      ndwi: f.properties.ndwi as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
