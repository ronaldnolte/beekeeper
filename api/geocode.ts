// GET /api/geocode?q= — address search for the map picker (SPEC D §5). Bearer header.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearerToken, handleCors, methodNotAllowed } from './_http.js';
import { getSignedInUser } from './_supabase.js';

export interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

async function openMeteo(q: string): Promise<GeoResult[]> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
  if (!res.ok) throw new Error(`Open-Meteo geocoding ${res.status}`);
  const body = (await res.json()) as { results?: { latitude: number; longitude: number; name?: string; admin1?: string; country?: string }[] };
  return (body.results ?? []).map(r => ({
    lat: r.latitude,
    lng: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

async function google(q: string, key: string): Promise<GeoResult[] | null> {
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`);
  const body = (await res.json()) as { status: string; results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
  if (body.status === 'OK') {
    return (body.results ?? []).slice(0, 5).map(r => ({ lat: r.geometry.location.lat, lng: r.geometry.location.lng, label: r.formatted_address }));
  }
  if (body.status === 'ZERO_RESULTS') return [];
  console.warn('[geocode] Google status', body.status);
  return null; // → fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    const auth = await getSignedInUser(bearerToken(req));
    if (!auth) return res.status(401).json({ error: 'You must be signed in to search.' });
    const raw = req.query.q;
    const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
    if (!q) return res.status(400).json({ error: 'A search term is required.' });

    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    const results = (key ? await google(q, key) : null) ?? (await openMeteo(q));
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.status(200).json({ results });
  } catch (err) {
    console.error('[geocode]', err);
    return res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}
