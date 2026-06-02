/**
 * Data Access Repository for the Nectar Flow Index (NFI).
 * Manages fetching from the Vercel API and client-side localStorage caching.
 */

export interface NectarIndexResponse {
  polygonId: string;
  baselineNDVI: number;
  currentNDVI: number;
  previousNDVI: number;
  weather: {
    tempF: number;
    humidity: number;
    precipitationMm: number;
  };
  nfi: number;
  breakdown: {
    nfi: number;
    ratio: number;
    layer1Score: number;
    layer1Max: number;
    delta: number;
    phenologyMultiplier: number;
    tempMultiplier: number;
    humidityMultiplier: number;
    isWashout: boolean;
  };
  isHistoryQueried: boolean;
  isPolygonCreated: boolean;
}

/**
 * Fetches the Nectar Flow Index for a given apiary location.
 * Utilizes localStorage to cache calculated NDVI baselines and polygon IDs to preserve API quota.
 * 
 * @param apiaryId The local DB apiary ID
 * @param lat Latitude in degrees
 * @param lng Longitude in degrees
 */
export async function fetchNectarIndex(
  apiaryId: string,
  lat: number,
  lng: number
): Promise<NectarIndexResponse> {
  const polygonKey = `nfi_polygon_${apiaryId}`;
  const baselineKey = `nfi_baseline_${apiaryId}`;
  const baselineYearKey = `nfi_baseline_year_${apiaryId}`;

  const currentYear = new Date().getFullYear();
  
  // Read cache
  let cachedPolygonId = localStorage.getItem(polygonKey);
  let cachedBaseline: number | null = null;
  const cachedBaselineYear = localStorage.getItem(baselineYearKey);

  // Only use cached baseline if it was calculated in the current calendar year
  if (cachedBaselineYear === currentYear.toString()) {
    const rawBaseline = localStorage.getItem(baselineKey);
    if (rawBaseline) {
      cachedBaseline = parseFloat(rawBaseline);
    }
  } else {
    // Clear stale baseline cache for new years
    localStorage.removeItem(baselineKey);
    localStorage.removeItem(baselineYearKey);
  }

  // Setup API URL matching other features
  const apiUrl = import.meta.env.DEV
    ? '/api/nectar-index'
    : 'https://beekeeper.beektools.com/api/nectar-index';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lat,
      lng,
      cachedBaseline,
      polygonId: cachedPolygonId || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch nectar flow index');
  }

  const data = (await response.json()) as NectarIndexResponse;

  // Persist responses to cache for subsequent calls
  if (data.polygonId) {
    localStorage.setItem(polygonKey, data.polygonId);
  }
  if (data.baselineNDVI !== undefined && data.baselineNDVI !== null) {
    localStorage.setItem(baselineKey, data.baselineNDVI.toString());
    localStorage.setItem(baselineYearKey, currentYear.toString());
  }

  return data;
}
