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

import { fetchFirstOk, getResendKey, escapeHtml } from '../_lib.js';

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

/** Calendar days from start to end inclusive — what a complete response must contain. */
export function expectedDayCount(startDate: string, endDate: string): number {
  const a = Date.parse(startDate + 'T00:00:00Z');
  const b = Date.parse(endDate + 'T00:00:00Z');
  if (!isFinite(a) || !isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Did the archive come back whole?
 *
 * Open-Meteo's archive is complete, so a short response means the request failed, not that
 * the weather is missing. A partial series must not be used: thresholds derived from it
 * would be silently wrong rather than absent. The last few days are allowed to be missing
 * because the archive lags real time and the forecast window covers the tail.
 */
export function isComplete(days: Record<string, WeatherDay>, startDate: string, endDate: string): boolean {
  const expected = expectedDayCount(startDate, endDate);
  if (!expected) return false;
  return Object.keys(days).length >= expected - 3;
}

/**
 * Email Ron when the weather source fails twice. There is no other signal that an apiary
 * silently stopped getting an index — the user just sees "unavailable" and shrugs.
 * Never throws: an alert that fails must not take the request down with it.
 */
async function alertWeatherFailure(detail: string): Promise<void> {
  try {
    const apiKey = getResendKey();
    if (!apiKey) { console.error('Weather failure, and no RESEND_API_KEY to report it:', detail); return; }
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BeekTools <beta@beektools.com>',
        to: 'ron.nolte@gmail.com',
        subject: 'Beekeeper: weather fetch failed twice',
        html: `<p>Open-Meteo did not return a complete series after a retry, so the index was not calculated.</p>
               <p style="font-family:monospace;font-size:13px">${escapeHtml(detail)}</p>`,
      }),
    });
  } catch (e) {
    console.error('Could not send weather failure alert:', e);
  }
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

export interface CompleteWeather extends WeatherResult {
  complete: true;
}

/**
 * Weather for a calculation that must not run on partial data.
 *
 * Fetches, and if the series is short, waits briefly and tries once more — a short response
 * means the request failed, not that the archive has holes, so a retry usually settles it.
 * If the second attempt is also short it emails Ron and returns null. The caller must then
 * report that the index is unavailable rather than computing something from a gap-filled
 * series, which would be wrong in a way nobody could see.
 */
export async function fetchCompleteWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  context = ''
): Promise<CompleteWeather | null> {
  let last: WeatherResult | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    last = await fetchWeather(lat, lng, startDate, endDate);
    if (isComplete(last.days, startDate, endDate)) {
      return { ...last, complete: true };
    }
    if (attempt === 1) await new Promise(r => setTimeout(r, 1200));
  }

  const got = last ? Object.keys(last.days).length : 0;
  await alertWeatherFailure(
    `${context}\nlat ${lat}, lng ${lng}\nrequested ${startDate} to ${endDate} ` +
    `(${expectedDayCount(startDate, endDate)} days)\nreceived ${got} days after two attempts\n` +
    `archive_ok=${last?.archive_ok} forecast_source=${last?.forecast_source}`
  );
  return null;
}
