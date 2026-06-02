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
