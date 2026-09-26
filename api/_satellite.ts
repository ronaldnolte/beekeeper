// Sentinel-2 vegetation indices around an apiary — FORMULAS §2.2.

import './_xhr-polyfill.js';
import ee from '@google/earthengine';
import type { BandRecord } from '../shared/nectar/engine.js';

const RADIUS_M = 4830; // ≈ 3-mile forage range
const SCALE_M = 20;
const MASKED_SCL = [3, 7, 8, 9, 10, 11]; // cloud shadow, cloud probabilities, cirrus, snow/ice
const BAND_LETTERS = 'CDEFGHJKLMNPQRSTUVWX'; // MGRS latitude bands, no I or O

let ready: Promise<void> | null = null;

/** Authenticate with the service account and initialise once per server instance. */
function initEarthEngine(): Promise<void> {
  ready ??= new Promise<void>((resolve, reject) => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) return reject(new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.'));
    let key: unknown;
    try {
      key = JSON.parse(raw);
    } catch {
      return reject(new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.'));
    }
    ee.data.authenticateViaPrivateKey(
      key,
      () => ee.initialize(null, null, () => resolve(), (e: unknown) => reject(new Error(String(e)))),
      (e: unknown) => reject(new Error(String(e))),
    );
  }).catch(err => {
    ready = null; // allow a retry on the next request
    throw err;
  });
  return ready;
}

/**
 * The nine MGRS prefixes that can be overhead: UTM zones z−1..z+1 (wrapping) × latitude bands
 * b−1..b+1 (bands outside 0–19 dropped). SCAR S-NEC-1: a corrupt Arctic scene with an infinite
 * footprint once matched every yard on Earth.
 */
export function tilePrefixes(lat: number, lon: number): string[] {
  const z = Math.floor((lon + 180) / 6) + 1;
  const b = Math.floor((lat + 80) / 8);
  const zones = [z - 1, z, z + 1].map(v => ((v - 1 + 60) % 60) + 1);
  const bands = [b - 1, b, b + 1].filter(v => v >= 0 && v <= 19);
  return zones.flatMap(zone => bands.map(band => `${zone}${BAND_LETTERS[band]}`));
}

export interface SatelliteData {
  /** Every distinct overflight date, cloudy or not. */
  passDates: string[];
  /** Usable scenes (all three means present), sorted by date; same-date scenes both kept. */
  records: BandRecord[];
}

interface SceneInfo {
  properties: { date: string; ndvi: number | null; evi: number | null; ndwi: number | null };
}

/** Scenes in [start, end) — the end date is exclusive, so today's scenes are not included. */
export async function fetchSatellite(lat: number, lon: number, start: string, end: string): Promise<SatelliteData> {
  await initEarthEngine();

  const disc = ee.Geometry.Point([lon, lat]).buffer(RADIUS_M);
  const tileFilter = ee.Filter.or(...tilePrefixes(lat, lon).map(p => ee.Filter.stringStartsWith('MGRS_TILE', p)));
  const scenes = ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(disc)
    .filterDate(start, end)
    .filter(tileFilter);

  const features = scenes.map((img: any) => {
    const scl = img.select('SCL');
    let clear = scl.neq(MASKED_SCL[0]);
    for (const c of MASKED_SCL.slice(1)) clear = clear.and(scl.neq(c));
    const m = img.updateMask(clear);
    const ndvi = m.normalizedDifference(['B8', 'B4']).rename('ndvi');
    const ndwi = m.normalizedDifference(['B8', 'B11']).rename('ndwi');
    // EVI is not ratio-invariant: scale to reflectance first (SCAR S-NEC-4).
    const evi = m
      .expression('2.5 * (N - R) / (N + 6 * R - 7.5 * B + 1)', {
        N: m.select('B8').multiply(0.0001),
        R: m.select('B4').multiply(0.0001),
        B: m.select('B2').multiply(0.0001),
      })
      .rename('evi');
    const means = ndvi.addBands(evi).addBands(ndwi).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: disc,
      scale: SCALE_M,
      maxPixels: 1e9,
    });
    return ee.Feature(null, {
      date: img.date().format('YYYY-MM-dd'), // day of MONTH, not day of year (SCAR S-NEC-5)
      ndvi: means.get('ndvi'),
      evi: means.get('evi'),
      ndwi: means.get('ndwi'),
    });
  });

  const info: { features: SceneInfo[] } = await new Promise((resolve, reject) =>
    ee.FeatureCollection(features).getInfo((result: { features: SceneInfo[] }, error?: string) =>
      error ? reject(new Error(error)) : resolve(result),
    ),
  );

  const all = info.features.map(f => f.properties);
  const passDates = [...new Set(all.map(p => p.date))].sort();
  const records = all
    .filter(p => p.ndvi != null && p.evi != null && p.ndwi != null)
    .map(p => ({ date: p.date, ndvi: p.ndvi as number, evi: p.evi as number, ndwi: p.ndwi as number }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { passDates, records };
}
