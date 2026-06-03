// Polyfill XMLHttpRequest for Google Earth Engine in Node.js serverless environments
// @ts-ignore
import { XMLHttpRequest } from 'xmlhttprequest';
if (typeof global !== 'undefined' && !(global as any).XMLHttpRequest) {
  (global as any).XMLHttpRequest = XMLHttpRequest;
}

// @ts-ignore
import ee from '@google/earthengine';

export interface NDVIInput {
  lat: number;
  lon: number;
  radius_km?: number;          // optional, default 3 km
  start_date: string;         // ISO date
  end_date: string;           // ISO date
  dataset: 'sentinel2' | 'modis';
  smoothing: 'none' | '7day' | '14day';
}

export interface NDVIRecord {
  date: string;
  ndvi: number;
}

// Global Earth Engine initialization flag
let isEEInitialized = false;

function initEarthEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isEEInitialized) {
      return resolve();
    }

    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) {
      return reject(new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing.'));
    }

    try {
      const credentials = JSON.parse(keyString);
      ee.data.authenticateViaPrivateKey(
        credentials,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              isEEInitialized = true;
              console.log('Google Earth Engine successfully initialized.');
              resolve();
            },
            (err: any) => reject(new Error(`EE Initialization failed: ${err}`))
          );
        },
        (err: any) => reject(new Error(`EE Auth failed: ${err}`))
      );
    } catch (e: any) {
      reject(new Error(`Failed to parse GEE credentials JSON: ${e.message}`));
    }
  });
}

/**
 * Evaluates a GEE expression returning a Promise.
 */
function evaluateExpression(expression: any): Promise<any> {
  return new Promise((resolve, reject) => {
    expression.evaluate((result: any, error: any) => {
      if (error) {
        reject(new Error(error));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Performs GEE query for either Sentinel-2 or MODIS and returns raw list of features.
 */
async function queryEarthEngine(
  geom: any,
  startDate: string,
  endDate: string,
  dataset: 'sentinel2' | 'modis'
): Promise<NDVIRecord[]> {
  const isS2 = dataset === 'sentinel2';
  const collectionId = isS2 ? 'COPERNICUS/S2_SR_HARMONIZED' : 'MODIS/006/MOD13Q1';
  const scale = isS2 ? 10 : 250;

  let col = ee.ImageCollection(collectionId)
    .filterBounds(geom)
    .filterDate(startDate, endDate);

  let processedCol;
  if (isS2) {
    // Sentinel-2 Cloud Masking and NDVI Math
    processedCol = col.map((image: any) => {
      const dateStr = image.date().format('YYYY-MM-DD');
      
      // Cloud Mask using SCL band
      const scl = image.select('SCL');
      const mask = scl.neq(3)  // Cloud shadow
        .and(scl.neq(7))       // Unclassified
        .and(scl.neq(8))       // Cloud medium probability
        .and(scl.neq(9))       // Cloud high probability
        .and(scl.neq(10))      // Thin cirrus
        .and(scl.neq(11));     // Snow / Ice
      const masked = image.updateMask(mask);

      // NDVI = (B8 - B4) / (B8 + B4)
      const ndvi = masked.normalizedDifference(['B8', 'B4']).rename('ndvi');

      const meanDict = ndvi.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: geom,
        scale: scale,
        maxPixels: 1e9
      });

      return ee.Feature(null, {
        date: dateStr,
        ndvi: meanDict.get('ndvi')
      });
    });
  } else {
    // MODIS NDVI Math (stored scaled by 0.0001)
    processedCol = col.map((image: any) => {
      const dateStr = image.date().format('YYYY-MM-DD');
      
      const ndvi = image.select('NDVI').multiply(0.0001).rename('ndvi');

      const meanDict = ndvi.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: geom,
        scale: scale,
        maxPixels: 1e9
      });

      return ee.Feature(null, {
        date: dateStr,
        ndvi: meanDict.get('ndvi')
      });
    });
  }

  // Filter out features where NDVI is null (clouds/no coverage)
  const filteredCol = processedCol.filter(ee.Filter.notNull(['ndvi']));

  // Evaluate feature collection
  const featureCollection = await evaluateExpression(filteredCol);
  
  if (!featureCollection || !featureCollection.features) {
    return [];
  }

  return featureCollection.features.map((f: any) => ({
    date: f.properties.date,
    ndvi: f.properties.ndvi
  }));
}

/**
 * Linearly interpolates the NDVI records to generate a continuous daily series.
 */
export function interpolateDailyNDVI(
  records: NDVIRecord[],
  startDateStr: string,
  endDateStr: string
): NDVIRecord[] {
  if (records.length === 0) {
    return [];
  }

  // 1. Group records by date (to handle duplicates by taking mean)
  const dateGroups: Record<string, number[]> = {};
  for (const r of records) {
    if (!dateGroups[r.date]) {
      dateGroups[r.date] = [];
    }
    dateGroups[r.date].push(r.ndvi);
  }

  const uniqueRecords = Object.keys(dateGroups).map(date => {
    const vals = dateGroups[date];
    const avg = vals.reduce((sum, val) => sum + val, 0) / vals.length;
    return {
      date,
      time: new Date(date).getTime(),
      ndvi: avg
    };
  });

  // Sort chronologically
  uniqueRecords.sort((a, b) => a.time - b.time);

  // 2. Generate daily timeline
  const dailySeries: NDVIRecord[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const currentStr = d.toISOString().slice(0, 10);
    const currentTime = d.getTime();

    // Check if we have an exact date match
    const exact = uniqueRecords.find(r => r.date === currentStr);
    if (exact) {
      // Clamp value
      const clamped = Math.min(1.0, Math.max(-1.0, exact.ndvi));
      dailySeries.push({ date: currentStr, ndvi: clamped });
      continue;
    }

    // Find bounding records
    let left: typeof uniqueRecords[0] | null = null;
    let right: typeof uniqueRecords[0] | null = null;

    for (const r of uniqueRecords) {
      if (r.time < currentTime) {
        left = r;
      } else if (r.time > currentTime) {
        right = r;
        break; // since sorted, first one after currentTime is the closest right
      }
    }

    let interpolatedVal = 0.5; // fallback default
    if (left && right) {
      const fraction = (currentTime - left.time) / (right.time - left.time);
      interpolatedVal = left.ndvi + fraction * (right.ndvi - left.ndvi);
    } else if (left) {
      interpolatedVal = left.ndvi;
    } else if (right) {
      interpolatedVal = right.ndvi;
    }

    // Clamp value
    const clamped = Math.min(1.0, Math.max(-1.0, interpolatedVal));
    dailySeries.push({ date: currentStr, ndvi: clamped });
  }

  return dailySeries;
}

/**
 * Applies optional moving average smoothing to the daily NDVI records.
 */
export function smoothNDVISeries(
  records: NDVIRecord[],
  smoothing: 'none' | '7day' | '14day'
): NDVIRecord[] {
  if (smoothing === 'none' || records.length === 0) {
    return records;
  }

  const windowSize = smoothing === '7day' ? 7 : 14;
  return records.map((item, idx) => {
    const startIdx = Math.max(0, idx - windowSize + 1);
    const slice = records.slice(startIdx, idx + 1);
    const sum = slice.reduce((acc, val) => acc + val.ndvi, 0);
    return {
      date: item.date,
      ndvi: sum / slice.length
    };
  });
}

/**
 * Reusable NDVI Fetcher Module function
 */
export async function fetchNDVI(input: NDVIInput): Promise<NDVIRecord[]> {
  // 1. Validate inputs
  const lat = parseFloat(input.lat as any);
  const lon = parseFloat(input.lon as any);
  if (isNaN(lat) || isNaN(lon)) {
    console.error('Invalid NDVI Fetcher Input: lat/lon must be valid numbers.');
    return [];
  }

  const radiusKm = input.radius_km !== undefined ? parseFloat(input.radius_km as any) : 3.0;
  const startDate = input.start_date;
  const endDate = input.end_date;

  try {
    // Initialize Earth Engine
    await initEarthEngine();

    // Define search Geometry
    let geom = ee.Geometry.Point([lon, lat]);
    if (radiusKm > 0) {
      geom = geom.buffer(radiusKm * 1000);
    }

    let records: NDVIRecord[] = [];

    // Try primary (Sentinel-2)
    if (input.dataset === 'sentinel2') {
      try {
        console.log(`Querying Sentinel-2 NDVI for lat=${lat}, lon=${lon}...`);
        records = await queryEarthEngine(geom, startDate, endDate, 'sentinel2');
      } catch (err: any) {
        console.warn(`Sentinel-2 query failed: ${err.message}. Falling back to MODIS...`);
        // Fallback to MODIS
        records = await queryEarthEngine(geom, startDate, endDate, 'modis');
      }
    } else {
      // Direct MODIS request
      console.log(`Querying MODIS NDVI for lat=${lat}, lon=${lon}...`);
      records = await queryEarthEngine(geom, startDate, endDate, 'modis');
    }

    // Interpolate daily gaps
    const dailySeries = interpolateDailyNDVI(records, startDate, endDate);

    // Apply optional smoothing
    const finalSeries = smoothNDVISeries(dailySeries, input.smoothing);

    return finalSeries;
  } catch (error: any) {
    // Log errors but never throw unhandled exceptions
    console.error(`NDVI Fetcher Error: ${error.message}`);
    return [];
  }
}
