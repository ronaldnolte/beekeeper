// Daily weather for the nectar engine from Open-Meteo — FORMULAS §2.4. A dead host degrades
// the data; it never fails the request (SCAR S-NEC-9).

import { fetchFirstOk } from './_http.js';
import { addDays } from '../shared/nectar/dates.js';

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_HOSTS = ['https://api.open-meteo.com', 'https://historical-forecast-api.open-meteo.com'];

export interface WeatherData {
  map: Record<string, { tmax: number; tmin: number; dew?: number }>;
  forecast_source: 'primary' | 'auxiliary' | 'none';
  archive_ok: boolean;
}

interface OpenMeteoDaily {
  daily?: { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] };
  hourly?: { time: string[]; dew_point_2m: (number | null)[] };
}

function query(lat: number, lon: number, start: string, end: string): string {
  return (
    `?latitude=${lat}&longitude=${lon}&temperature_unit=fahrenheit&timezone=auto` +
    '&daily=temperature_2m_max,temperature_2m_min&hourly=dew_point_2m' +
    `&start_date=${start}&end_date=${end}`
  );
}

/**
 * @param today the server's UTC calendar day (pinned in tests)
 */
export async function fetchWeather(
  lat: number,
  lon: number,
  start: string,
  end: string,
  today: string,
): Promise<WeatherData> {
  const historical = end < today;
  const archiveEnd = historical ? end : addDays(today, -3);

  const archiveCall = fetchFirstOk([`${ARCHIVE}${query(lat, lon, start, archiveEnd)}`], 12_000);
  const recentCall = historical
    ? Promise.resolve(null)
    : fetchFirstOk(FORECAST_HOSTS.map(h => `${h}/v1/forecast${query(lat, lon, addDays(today, -10), end)}`), 8_000);
  const [archiveHit, recentHit] = await Promise.all([archiveCall, recentCall]);

  const sources: OpenMeteoDaily[] = [];
  let archive_ok = false;
  if (archiveHit) {
    try {
      sources.push(await archiveHit.response.json());
      archive_ok = true;
    } catch (err) {
      console.warn('[weather] archive body unreadable', err);
    }
  }
  let forecast_source: WeatherData['forecast_source'] = 'none';
  if (recentHit) {
    try {
      sources.push(await recentHit.response.json());
      forecast_source = recentHit.index === 0 ? 'primary' : 'auxiliary';
    } catch (err) {
      console.warn('[weather] forecast body unreadable', err);
    }
  }

  // Merge: archive first, then forecast; a non-null daily value overwrites. Dew = mean of every
  // hourly value from both sources for that local date, rounded to 2 dp.
  const days: Record<string, { tmax?: number; tmin?: number }> = {};
  const dew: Record<string, { sum: number; n: number }> = {};
  for (const s of sources) {
    const d = s.daily;
    d?.time.forEach((date, i) => {
      const row = (days[date] ??= {});
      if (d.temperature_2m_max[i] != null) row.tmax = d.temperature_2m_max[i] as number;
      if (d.temperature_2m_min[i] != null) row.tmin = d.temperature_2m_min[i] as number;
    });
    const h = s.hourly;
    h?.time.forEach((t, i) => {
      const v = h.dew_point_2m[i];
      if (v == null) return;
      const acc = (dew[t.slice(0, 10)] ??= { sum: 0, n: 0 });
      acc.sum += v;
      acc.n++;
    });
  }

  const map: WeatherData['map'] = {};
  for (const date of Object.keys(days).sort()) {
    const { tmax, tmin } = days[date];
    if (tmax == null || tmin == null) continue;
    const d = dew[date];
    // toFixed, not Math.round: it rounds the binary value, so 22.475 → 22.47. Verified
    // 2026-09-26 against the live fetcher's output (fixtures-live): Math.round differs by 0.01
    // on ~35 days per site; toFixed matches every day.
    map[date] = d ? { tmax, tmin, dew: Number((d.sum / d.n).toFixed(2)) } : { tmax, tmin };
  }
  return { map, forecast_source, archive_ok };
}
