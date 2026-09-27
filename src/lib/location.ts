// Where an apiary is, for Forecast and Nectar Flow — SPEC C §1 ("resolveApiaryCoords").

import type { Apiary } from './supabase';

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * 1. Both coordinates truthy → use them (zero counts as missing; coordinates win over a zip).
 * 2. Else a zip → Open-Meteo place search (old "US:87105" values: the part after the first ":").
 * 3. Else → no location.
 */
export async function resolveApiaryCoords(apiary: Pick<Apiary, 'latitude' | 'longitude' | 'zip_code'>, signal?: AbortSignal): Promise<Coords> {
  if (apiary.latitude && apiary.longitude) return { lat: apiary.latitude, lng: apiary.longitude };

  if (apiary.zip_code) {
    const raw = apiary.zip_code;
    const zip = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&language=en&format=json`;
    const timeout = AbortSignal.timeout(6000);
    const combined = signal ? anySignal([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await fetch(url, { signal: combined });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (timeout.aborted) throw new Error('Geocoding request timed out. Please check your internet connection.');
      throw err;
    }
    if (!res.ok) throw new Error(`Geocoding service returned status ${res.status}`);
    const data = (await res.json()) as { results?: { latitude: number; longitude: number }[] };
    const hit = data.results?.[0];
    if (!hit) throw new Error(`Could not find coordinates for Zip Code: ${zip}`);
    return { lat: hit.latitude, lng: hit.longitude };
  }

  throw new Error('Apiary has no location data (no lat/lng or zip code).');
}

/** An AbortSignal that fires when any of the given ones does (AbortSignal.any is not in older browsers). */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctl.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => ctl.abort(s.reason), { once: true });
  }
  return ctl.signal;
}

/** Apiary card subtitle used by the Apiaries and Nectar lists (SPEC B §4). */
export function apiarySubtitle(a: Pick<Apiary, 'zip_code' | 'latitude'>): string {
  if (a.zip_code) return `ZIP: ${a.zip_code}`;
  if (a.latitude != null) return 'Location: Coordinates';
  return 'No location set';
}
