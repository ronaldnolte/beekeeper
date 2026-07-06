/**
 * Shared geocoding utility.
 * Resolves an apiary's coordinates from lat/lng or zip code.
 * Deduplicates the pattern previously copy-pasted in 4+ files.
 */

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
 * Free-text place search (zip code or town/city name) via Open-Meteo's
 * geocoding API — the same free, no-key service used to resolve apiary zip
 * codes above. Returns the top match, or null if nothing was found.
 * Resolves places and postal codes, NOT full street addresses.
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Search service returned status ${res.status}`);

    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;

    const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    return { lat: r.latitude, lng: r.longitude, label };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Search timed out. Please check your connection.');
    }
    throw err;
  }
}
