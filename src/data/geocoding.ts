/**
 * Shared geocoding utility.
 * Resolves an apiary's coordinates from lat/lng or zip code.
 * Deduplicates the pattern previously copy-pasted in 4+ files.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

interface ApiaryLocation {
  latitude?: number | null;
  longitude?: number | null;
  zip_code?: string | null;
}

export async function resolveApiaryCoords(
  apiary: ApiaryLocation
): Promise<{ lat: number; lng: number }> {
  let lat = apiary.latitude;
  let lng = apiary.longitude;

  if (lat && lng) {
    return { lat, lng };
  }

  if (apiary.zip_code) {
    const cleanZip = apiary.zip_code.includes(':')
      ? apiary.zip_code.split(':')[1]
      : apiary.zip_code;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cleanZip}&count=1&language=en&format=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s geocoding timeout

    try {
      const geoRes = await fetch(geoUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!geoRes.ok) {
        throw new Error(`Geocoding service returned status ${geoRes.status}`);
      }

      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        return {
          lat: geoData.results[0].latitude,
          lng: geoData.results[0].longitude,
        };
      }
      throw new Error('Could not find coordinates for Zip Code: ' + apiary.zip_code);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Geocoding request timed out. Please check your internet connection.');
      }
      throw err;
    }
  }

  throw new Error('Apiary has no location data (no lat/lng or zip code).');
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Address / place search for the map picker. Calls our own `/api/geocode`
 * endpoint, which proxies Google Geocoding server-side (full street addresses)
 * and falls back to Open-Meteo place/postal search when no Google key is set.
 * Returns up to 5 matches for the user to pick from. Requires a signed-in
 * session (the endpoint gates the paid call), so we send the access token.
 */
export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];

  const { data: { session } } = await supabase.auth.getSession();
  const base = Capacitor.isNativePlatform()
    ? 'https://beekeeper.beektools.com/api/geocode'
    : '/api/geocode';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${base}?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Please sign in to search.' : `Search failed (${res.status}).`);
    }
    const data = await res.json();
    return Array.isArray(data.results) ? (data.results as GeocodeResult[]) : [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Search timed out. Please check your connection.');
    }
    throw err;
  }
}
