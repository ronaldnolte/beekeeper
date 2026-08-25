// Daily weather for a location: max/min temperature and mean dewpoint, from Open-Meteo.
//
// Moved here verbatim from api/nectar-index-v2.ts (2026-08). It was private there while
// api/bloom.ts carried a second, simpler Open-Meteo call of its own, and the bloom engine
// needed a third. Three copies of the same fetch is how the harness ended up with its own
// hardcoded start date that silently drifted a year behind the app's — so there is now one.
//
// The failover matters and is why this is not a two-line fetch. The recent window tries the
// primary Forecast API, then Open-Meteo's separately-hosted Historical Forecast API — same
// request shape, same model data, hours-stale at worst. That path earned its place on
// 2026-07-03 when the primary went down while the auxiliary stayed up. fetchFirstOk never
// rejects, so a dead host degrades the data rather than failing the whole request.

import { fetchFirstOk } from '../_lib.js';

export interface WeatherDay {
  tmax: number;
  tmin: number;
  dew: number | null;
}

export interface WeatherResult {
  days: Record<string, WeatherDay>;
  /** Which host supplied the recent window. Outage diagnostics. */
  forecast_source: 'primary' | 'auxiliary' | 'none';
  archive_ok: boolean;
}

interface OMDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
}
interface OMHourly {
  time: string[];
  dew_point_2m: (number | null)[];
}

/** First of January, five years back. The one place this window is defined. */
export function historyStartDate(today = new Date()): string {
  return `${today.getUTCFullYear() - 5}-01-01`;
}

export async function fetchWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<WeatherResult> {
  const today = new Date();
  const archiveEnd = new Date(today.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
  const recentStart = new Date(today.getTime() - 10 * 86_400_000).toISOString().slice(0, 10);

  const base = `latitude=${lat}&longitude=${lng}&temperature_unit=fahrenheit&timezone=auto`;
  const dailyVars = 'daily=temperature_2m_max,temperature_2m_min';
  const hourlyVars = 'hourly=dew_point_2m&temperature_unit=fahrenheit';

  const map: Record<string, { tmax: number | null; tmin: number | null; _ds: number; _dn: number }> = {};
  const ensure = (d: string) => { if (!map[d]) map[d] = { tmax: null, tmin: null, _ds: 0, _dn: 0 }; return map[d]; };

  function absorbDaily(daily: OMDaily | null) {
    if (!daily?.time) return;
    for (let i = 0; i < daily.time.length; i++) {
      const e = ensure(daily.time[i]);
      if (daily.temperature_2m_max[i] != null) e.tmax = daily.temperature_2m_max[i];
      if (daily.temperature_2m_min[i] != null) e.tmin = daily.temperature_2m_min[i];
    }
  }
  function absorbHourlyDew(hourly: OMHourly | null) {
    if (!hourly?.time) return;
    for (let i = 0; i < hourly.time.length; i++) {
      const dp = hourly.dew_point_2m[i];
      if (dp == null) continue;
      const d = hourly.time[i].slice(0, 10);
      const e = ensure(d);
      e._ds += dp; e._dn++;
    }
  }

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${archiveEnd}&${dailyVars}&${hourlyVars}`;
  const forecastPath = `/v1/forecast?${base}&start_date=${recentStart}&end_date=${endDate}&${dailyVars}&${hourlyVars}`;
  const forecastCandidates = [
    `https://api.open-meteo.com${forecastPath}`,
    `https://historical-forecast-api.open-meteo.com${forecastPath}`,
  ];

  const [arch, fc] = await Promise.all([
    fetchFirstOk([archiveUrl], 12_000),
    fetchFirstOk(forecastCandidates, 8_000),
  ]);

  if (arch) {
    const j = await arch.res.json();
    absorbDaily(j.daily ?? null);
    absorbHourlyDew(j.hourly ?? null);
  }
  if (fc) {
    const j = await fc.res.json();
    absorbDaily(j.daily ?? null);
    absorbHourlyDew(j.hourly ?? null);
  }

  const out: Record<string, WeatherDay> = {};
  for (const [d, e] of Object.entries(map)) {
    if (e.tmax == null || e.tmin == null) continue;
    out[d] = {
      tmax: e.tmax,
      tmin: e.tmin,
      dew:  e._dn ? +(e._ds / e._dn).toFixed(2) : null,
    };
  }
  return {
    days: out,
    forecast_source: fc ? (fc.url.includes('historical-forecast') ? 'auxiliary' : 'primary') : 'none',
    archive_ok: !!arch,
  };
}
