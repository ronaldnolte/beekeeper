import { applyCors, getAuthedUser, getBearerToken } from './_lib.js';

// Place/address search for the apiary map picker. Proxies Google Geocoding
// (key stays server-side) so full street addresses resolve; falls back to
// Open-Meteo's free place/postal search when no Google key is configured, so
// the feature degrades gracefully instead of breaking. Requires a signed-in
// user — geocoding is a paid call, so it must not be open to anyone.

interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

async function openMeteoFallback(q: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.results)) return [];
  return data.results.map((it: any) => ({
    lat: it.latitude,
    lng: it.longitude,
    label: [it.name, it.admin1, it.country].filter(Boolean).join(', '),
  }));
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await getAuthedUser(getBearerToken(req));
  if (!auth) {
    res.status(401).json({ error: 'You must be signed in to search.' });
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'A search term is required.' });
    return;
  }

  try {
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    let results: GeoResult[] = [];

    if (key) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`;
      const gRes = await fetch(url);
      const data = await gRes.json();

      if (data.status === 'OK' && Array.isArray(data.results)) {
        results = data.results.slice(0, 5).map((it: any) => ({
          lat: it.geometry.location.lat,
          lng: it.geometry.location.lng,
          label: it.formatted_address,
        }));
      } else if (data.status === 'ZERO_RESULTS') {
        results = [];
      } else {
        // Key misconfigured / quota / bad request — log and degrade gracefully.
        console.error('Google Geocoding error:', data.status, data.error_message || '');
        results = await openMeteoFallback(q);
      }
    } else {
      results = await openMeteoFallback(q);
    }

    res.setHeader('Cache-Control', 'private, max-age=600');
    res.status(200).json({ results });
  } catch (err: any) {
    console.error('Geocode error:', err?.message || err);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}
