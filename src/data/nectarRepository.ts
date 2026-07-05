/**
 * Data Access Repository for the Nectar Flow Index (NFI).
 * Manages fetching from the Vercel API and client-side localStorage caching.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export interface NectarIndexResponse {
  polygonId: string;
  baselineNDVI: number;
  currentNDVI: number;
  previousNDVI: number;
  ndviRawLatest: number;
  nfi: number;
  status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low';
  slope: number;
  transitionAdvice: string;
  breakdown: {
    nfi: number;
    ratio: number;
    layer1Score: number;
    layer1Max: number;
    slope: number;
    phenologyBoost: number;
    status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low';
    transitionAdvice: string;
  };
  isHistoryQueried: boolean;
  isPolygonCreated: boolean;
  isMock: boolean;
  history?: { date: string; nfi: number }[];
  usda_zone?: number;
  min_temp_of_year?: number;
  plant_profile_info?: { name: string; bloom_start: string; bloom_peak: string; bloom_end: string }[];
}

/**
 * Fetches the Nectar Flow Index for a given apiary location.
 * Utilizes localStorage to cache calculated NDVI baselines and polygon IDs to preserve API quota.
 * 
 * @param apiaryId The local DB apiary ID
 * @param lat Latitude in degrees
 * @param lng Longitude in degrees
 */
// Bump this version to invalidate all client-side NFI caches (e.g. after fixing API bugs)
// v4: exponential averaging + 3-year typical-baseline scoring.
const NFI_CACHE_VERSION = 4;

export async function fetchNectarIndex(
  apiaryId: string,
  lat: number,
  lng: number
): Promise<NectarIndexResponse> {
  const polygonKey = `nfi_polygon_${apiaryId}`;
  const baselineKey = `nfi_baseline_${apiaryId}`;
  const baselineYearKey = `nfi_baseline_year_${apiaryId}`;
  const responseCacheKey = `nfi_response_${apiaryId}`;
  const responseTimeCacheKey = `nfi_response_time_${apiaryId}`;
  const cacheVersionKey = `nfi_cache_version`;

  const currentYear = new Date().getFullYear();
  
  // Clean up old cached polygon IDs
  localStorage.removeItem(polygonKey);

  // Invalidate all caches if version has changed
  const storedVersion = localStorage.getItem(cacheVersionKey);
  if (storedVersion !== NFI_CACHE_VERSION.toString()) {
    // Clear ALL NFI cache entries for every apiary
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('nfi_response_') || key.startsWith('nfi_response_time_') || key.startsWith('nfi_baseline_') || key.startsWith('nfi_baseline_year_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(cacheVersionKey, NFI_CACHE_VERSION.toString());
    console.log(`NFI cache version bumped to ${NFI_CACHE_VERSION}, cleared ${keysToRemove.length} stale entries.`);
  }

  // 1. Check client-side full response cache (1 hour lifetime)
  const cachedResponseStr = localStorage.getItem(responseCacheKey);
  const cachedResponseTimeStr = localStorage.getItem(responseTimeCacheKey);

  // Bypass cache in development mode to ensure changes are always loaded fresh
  if (cachedResponseStr && cachedResponseTimeStr && !import.meta.env.DEV) {
    const cachedTime = parseInt(cachedResponseTimeStr, 10);
    const now = Date.now();
    if (now - cachedTime < 3600000) { // 1 hour
      try {
        const cachedData = JSON.parse(cachedResponseStr) as NectarIndexResponse;
        // Validate the cache contains the new schema fields to prevent UI crashes
        if (
          cachedData &&
          cachedData.status &&
          typeof cachedData.slope === 'number' &&
          Array.isArray(cachedData.history) &&
          typeof cachedData.nfi === 'number'
        ) {
          console.log(`Loaded cached Nectar Flow Index for apiary ${apiaryId} (cache age: ${Math.round((now - cachedTime) / 60000)} mins)`);
          return cachedData;
        } else {
          console.warn(`Ignoring cached NFI response for apiary ${apiaryId} due to outdated or incomplete schema.`);
          localStorage.removeItem(responseCacheKey);
          localStorage.removeItem(responseTimeCacheKey);
        }
      } catch (e) {
        console.error("Failed to parse cached NFI response:", e);
      }
    }
  }

  let cachedBaseline: number | null = null;
  const cachedBaselineYear = localStorage.getItem(baselineYearKey);

  // Only use cached baseline if it was calculated in the current calendar year (skip in DEV mode)
  if (cachedBaselineYear === currentYear.toString() && !import.meta.env.DEV) {
    const rawBaseline = localStorage.getItem(baselineKey);
    if (rawBaseline) {
      cachedBaseline = parseFloat(rawBaseline);
    }
  } else {
    // Clear stale baseline cache for new years or DEV mode
    localStorage.removeItem(baselineKey);
    localStorage.removeItem(baselineYearKey);
  }

  // Setup API URL matching other features: web is same-origin, only the
  // packaged native app needs the absolute production host.
  const apiUrl = Capacitor.isNativePlatform()
    ? 'https://beekeeper.beektools.com/api/nectar-index'
    : '/api/nectar-index';

  // Format coordinates to 4 decimal places (~11m precision) to maximize CDN cache hit rate
  const roundedLat = lat.toFixed(4);
  const roundedLng = lng.toFixed(4);

  let queryUrl = `${apiUrl}?lat=${roundedLat}&lng=${roundedLng}`;
  if (cachedBaseline !== undefined && cachedBaseline !== null) {
    queryUrl += `&cachedBaseline=${cachedBaseline}`;
  }

  // If cachedBaseline is null, it means it's a force-refresh (the cache was cleared).
  // Append timestamp to force Vercel CDN cache bypass.
  if (cachedBaseline === null) {
    queryUrl += `&t=${Date.now()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s serverless timeout

  // The endpoint requires a signed-in user (it triggers paid Earth Engine
  // work) — pass the session token in the Authorization header.
  const { data: { session } } = await supabase.auth.getSession();

  try {
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch nectar flow index');
    }

    const data = (await response.json()) as NectarIndexResponse;

    // Persist baseline and full response to localStorage cache
    if (data.baselineNDVI !== undefined && data.baselineNDVI !== null && !isNaN(data.baselineNDVI)) {
      localStorage.setItem(baselineKey, data.baselineNDVI.toString());
      localStorage.setItem(baselineYearKey, currentYear.toString());
    }

    const hasNaN = isNaN(data.baselineNDVI) || isNaN(data.currentNDVI) || isNaN(data.nfi) || isNaN(data.slope);
    if (!hasNaN) {
      localStorage.setItem(responseCacheKey, JSON.stringify(data));
      localStorage.setItem(responseTimeCacheKey, Date.now().toString());
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Nectar Flow Index request timed out. Please try again.');
    }
    throw err;
  }
}
