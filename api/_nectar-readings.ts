// Saved nectar readings: keep the raw satellite + weather readings per apiary in
// the nectar_readings table (supabase/migrations/0014) so a load only fetches the
// last few weeks, instead of six years from scratch.
//
// RAW READINGS, NOT INDEX NUMBERS. The formula is still tuned now and then; saved
// index numbers would go stale with every tune. The formula re-runs on these in
// well under a second — the slow part was only ever the fetching.
//
// NEVER FATAL. Every database step here fails soft: a read error means a full
// fetch, a write error means the next load does a full fetch. The nectar report
// itself must never break because this table is missing or unreachable.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MultiBandRecord } from './_bands-fetcher.js';
import type { WeatherDay } from './_nectar-v2-engine.js';

/**
 * How far back each load fetches again, even though it is already saved.
 * Recent weather is a first estimate that Open-Meteo revises over the following
 * days, and a satellite pass can appear in Google's catalogue days late. Three
 * weeks comfortably covers both; everything older is final.
 */
export const REFETCH_OVERLAP_DAYS = 21;

export interface SavedReadings {
  builtLat: number;
  builtLon: number;
  coveredFrom: string;      // YYYY-MM-DD
  fetchedThrough: string;   // YYYY-MM-DD
  scenes: MultiBandRecord[];
  passDates: string[];
  weather: Record<string, WeatherDay>;
}

export type FetchPlan =
  | { mode: 'full'; fetchFrom: string; reason: 'none-saved' | 'moved' | 'window-earlier' }
  | { mode: 'recent'; fetchFrom: string };

/** Coordinates as the app sends them: 4 decimal places, about 11 metres. */
export function roundCoord(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Decide what to fetch. A full fetch when nothing usable is saved, when the
 * apiary has moved, or when the window reaches further back than the saved copy;
 * otherwise only from three weeks before the last fetch.
 */
export function planFetch(
  saved: SavedReadings | null,
  lat: number,
  lng: number,
  startDate: string
): FetchPlan {
  if (!saved) return { mode: 'full', fetchFrom: startDate, reason: 'none-saved' };
  if (roundCoord(saved.builtLat) !== roundCoord(lat) || roundCoord(saved.builtLon) !== roundCoord(lng)) {
    return { mode: 'full', fetchFrom: startDate, reason: 'moved' };
  }
  if (saved.coveredFrom > startDate) {
    return { mode: 'full', fetchFrom: startDate, reason: 'window-earlier' };
  }
  const back = addDays(saved.fetchedThrough, -REFETCH_OVERLAP_DAYS);
  return { mode: 'recent', fetchFrom: back > startDate ? back : startDate };
}

/**
 * Join the saved readings to a fresh fetch that starts at `fetchFrom`.
 *
 * Satellite: the fresh fetch REPLACES everything from `fetchFrom` on. An Earth
 * Engine call either returns the whole range or throws, so a fresh result is
 * complete for its range — and replacing (not adding) is what keeps a scene
 * from being counted twice. Pass dates the same way.
 *
 * Weather: the fresh days are laid OVER the saved ones, day by day. The weather
 * fetch degrades rather than throws (a dead forecast host just leaves recent days
 * out), so a saved day is kept unless the fresh fetch actually has that day.
 *
 * Anything before `startDate` is dropped, which is how the oldest year falls off
 * each January.
 */
export function mergeReadings(
  saved: SavedReadings,
  fresh: { scenes: MultiBandRecord[]; passDates: string[]; weather: Record<string, WeatherDay> },
  fetchFrom: string,
  startDate: string
): { scenes: MultiBandRecord[]; passDates: string[]; weather: Record<string, WeatherDay> } {
  const keepOld = (d: string) => d >= startDate && d < fetchFrom;

  const scenes = [...saved.scenes.filter(s => keepOld(s.date)), ...fresh.scenes]
    .sort((a, b) => a.date.localeCompare(b.date));

  const passDates = Array.from(new Set([
    ...saved.passDates.filter(keepOld),
    ...fresh.passDates,
  ])).sort();

  const weather: Record<string, WeatherDay> = {};
  for (const [d, w] of Object.entries(saved.weather)) if (d >= startDate) weather[d] = w;
  for (const [d, w] of Object.entries(fresh.weather)) weather[d] = w;

  return { scenes, passDates, weather };
}

/** Load the saved readings for an apiary, or null (none saved, or any error). */
export async function loadReadings(
  supabase: SupabaseClient,
  apiaryId: string
): Promise<SavedReadings | null> {
  try {
    const { data, error } = await supabase
      .from('nectar_readings')
      .select('built_lat, built_lon, covered_from, fetched_through, scenes, pass_dates, weather')
      .eq('apiary_id', apiaryId)
      .maybeSingle();
    if (error) {
      console.warn('nectar_readings read failed:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      builtLat: Number(data.built_lat),
      builtLon: Number(data.built_lon),
      coveredFrom: data.covered_from,
      fetchedThrough: data.fetched_through,
      scenes: Array.isArray(data.scenes) ? data.scenes : [],
      passDates: Array.isArray(data.pass_dates) ? data.pass_dates : [],
      weather: data.weather && typeof data.weather === 'object' ? data.weather : {},
    };
  } catch (e: any) {
    console.warn('nectar_readings read threw:', e?.message ?? e);
    return null;
  }
}

/** Save (insert or overwrite) an apiary's readings. Returns whether it worked. */
export async function saveReadings(
  supabase: SupabaseClient,
  userId: string,
  apiaryId: string,
  row: SavedReadings
): Promise<boolean> {
  try {
    const { error } = await supabase.from('nectar_readings').upsert({
      apiary_id: apiaryId,
      user_id: userId,
      built_lat: roundCoord(row.builtLat),
      built_lon: roundCoord(row.builtLon),
      covered_from: row.coveredFrom,
      fetched_through: row.fetchedThrough,
      scenes: row.scenes,
      pass_dates: row.passDates,
      weather: row.weather,
    }, { onConflict: 'apiary_id' });
    if (error) {
      console.warn('nectar_readings save failed:', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('nectar_readings save threw:', e?.message ?? e);
    return false;
  }
}
