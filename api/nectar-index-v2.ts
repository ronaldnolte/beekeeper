import { applyCors, getAuthedUser, getBearerToken, createRateLimiter, getClientIp, isNectarAuthGraceActive, sendUpdateRequired } from './_lib.js';
import { fetchMultiBands } from './_bands-fetcher.js';
import { runV2Pipeline, Phase, WeatherDay } from './_nectar-v2-engine.js';
import { fetchFirstOk } from './_lib.js';

// Anonymous nectar calls are only possible during the auth grace window (see
// _lib). Rate-limit them to blunt scripted abuse of the paid Earth Engine /
// weather work while old app builds age out.
const nectarLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

// Open-Meteo response shapes
interface OMDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
}
interface OMHourly {
  time: string[];
  dew_point_2m: (number | null)[];
}

interface WeatherV2Result {
  days: Record<string, WeatherDay>;
  /** Which host supplied the recent/forecast window (outage diagnostics). */
  forecast_source: 'primary' | 'auxiliary' | 'none';
  archive_ok: boolean;
}

async function fetchWeatherV2(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<WeatherV2Result> {
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
  // Recent window: primary Forecast API, then Open-Meteo's separately-hosted
  // auxiliary Historical Forecast API (same request/response shape, same model
  // data, hours-stale at worst). Proven necessary 2026-07-03 when the primary
  // went down while the auxiliary stayed at 100% uptime.
  const forecastPath = `/v1/forecast?${base}&start_date=${recentStart}&end_date=${endDate}&${dailyVars}&${hourlyVars}`;
  const forecastCandidates = [
    `https://api.open-meteo.com${forecastPath}`,
    `https://historical-forecast-api.open-meteo.com${forecastPath}`,
  ];

  // fetchFirstOk never rejects — a dead host degrades the data instead of
  // killing the whole request (the old Promise.all([fetch, fetch]) did).
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

function phaseToStatus(phase: Phase): 'Trending Up' | 'In Flow' | 'Trending Down' | 'Dearth' {
  switch (phase) {
    case 'TRENDING_UP':   return 'Trending Up';
    case 'IN_FLOW':       return 'In Flow';
    case 'TRENDING_DOWN': return 'Trending Down';
    case 'DEARTH':
    default:              return 'Dearth';
  }
}

// The advice text was removed 2026-08-28. Ron: "I think its spotty at best. Too many
// variables. Many of which are not even on the chart." A phase and a direction are what
// this data supports; what to DO about them depends on the colony, the climate and the
// beekeeper's own practice, none of which the index can see.

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Every request here triggers paid Earth Engine + weather work, so only
  // signed-in users may call it. GET request — the token rides the header.
  const auth = await getAuthedUser(getBearerToken(req));
  if (!auth) {
    // During the temporary grace window, let already-installed app builds
    // (which don't yet send a token) through, but rate-limit those anonymous
    // calls to blunt abuse. Once the window closes, tell them to update.
    if (!isNectarAuthGraceActive()) {
      sendUpdateRequired(res);
      return;
    }
    if (nectarLimiter(getClientIp(req))) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
  }

  const { lat: latRaw, lng: lngRaw, alpha: alphaRaw, rateLag: rateLagRaw, dwell: dwellRaw } = req.query;
  if (!latRaw || !lngRaw) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }
  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'lat and lng must be valid numbers' });
    return;
  }

  // Optional param overrides for tester experimentation
  const paramOverrides: Record<string, number> = {};
  if (alphaRaw)   { const v = parseFloat(alphaRaw);   if (!isNaN(v) && v > 0 && v < 1)  paramOverrides.alpha   = v; }
  if (rateLagRaw) { const v = parseInt(rateLagRaw);   if (!isNaN(v) && v > 0 && v <= 90) paramOverrides.rateLag = v; }
  if (dwellRaw)   { const v = parseInt(dwellRaw);     if (!isNaN(v) && v > 0 && v <= 30) paramOverrides.dwell   = v; }
  const hasOverrides = Object.keys(paramOverrides).length > 0;

  try {
    // Rolling 3-year comparative window: Jan 1 of three years ago through today.
    // Previously hardcoded to '2023-01-01', which made the window — and thus the
    // Earth Engine query and the response payload — grow without bound every year.
    // Mirrors the same fix already applied to the V1 endpoint (api/nectar-index.ts).
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear - 3}-01-01`;
    const endDate = new Date().toISOString().slice(0, 10);

    // Per-phase timing so a slow load can be diagnosed. Only meaningful on a
    // fresh (cache-bypassing) request — a CDN hit returns these numbers from the
    // original computation, not the current call. Earth Engine and weather run
    // in parallel, so each is timed independently to see which one dominates.
    const t0 = Date.now();
    const timed = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
      const s = Date.now();
      const r = await fn();
      return [r, Date.now() - s];
    };

    const [[bands, earthEngineMs], [weather, weatherMs]] = await Promise.all([
      timed(() => fetchMultiBands(lat, lng, startDate, endDate)),
      timed(() => fetchWeatherV2(lat, lng, startDate, endDate)),
    ]);

    if (bands.length === 0) {
      throw new Error('Earth Engine returned no vegetation data for this location.');
    }

    const pipeStart = Date.now();
    // When the satellite actually looked at this apiary, and when it is due back.
    //
    // "Next" is a forecast, not a schedule we are told: Sentinel-2's revisit is
    // regular, but a pass only becomes a usable scene when the sky is clear
    // enough, so the honest estimate comes from this location's OWN recent
    // cadence rather than a published orbit figure. Median gap over the last
    // handful of scenes, added to the last one; clamped to the 2-10 day range
    // the constellation can actually deliver, and only offered when there are
    // enough scenes to see a pattern.
    const sceneDates = bands.map((b) => b.date).sort();
    const lastScene = sceneDates[sceneDates.length - 1] ?? null;
    let nextSceneEstimate: string | null = null;
    if (sceneDates.length >= 4 && lastScene) {
      const recent = sceneDates.slice(-8);
      const gaps: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        const days = Math.round(
          (Date.parse(recent[i] + 'T00:00:00Z') - Date.parse(recent[i - 1] + 'T00:00:00Z')) / 86_400_000
        );
        if (days > 0) gaps.push(days);
      }
      if (gaps.length) {
        gaps.sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        const step = Math.min(10, Math.max(2, median));
        const next = new Date(Date.parse(lastScene + 'T00:00:00Z') + step * 86_400_000);
        nextSceneEstimate = next.toISOString().slice(0, 10);
      }
    }

    const result = runV2Pipeline(bands, weather.days, lat, paramOverrides);
    const pipelineMs = Date.now() - pipeStart;
    const serverTotalMs = Date.now() - t0;

    const N = result.dates.length;
    if (N === 0) throw new Error('V2 pipeline produced no output.');

    const li = N - 1;
    const latestEwma = result.idxEwma[li];
    const latestPhase = result.phases[li];
    const latestSlope = result.slopeArr[li] ?? 0;
    const nfi = Math.round(latestEwma * 100);
    const trend_direction: 'rising' | 'falling' | 'flat' =
      latestSlope > 0.002 ? 'rising' : latestSlope < -0.002 ? 'falling' : 'flat';

    // Skip cache when params are being tuned so each combination is fresh.
    // `private` (browser-only): a shared CDN cache would serve stored responses
    // without ever seeing the sign-in check above.
    if (req.method === 'GET' && !hasOverrides) {
      res.setHeader('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    }

    res.status(200).json({
      nfi,
      phase: latestPhase,
      status: phaseToStatus(latestPhase),
      trend_direction,
      slope: latestSlope,
      v2: result.latest,
      full_history: result.history,
      satellite: {
        last_scene: lastScene,
        next_scene_estimate: nextSceneEstimate,
        scene_count: bands.length,
      },
      _timing: {
        earth_engine_ms: earthEngineMs,
        weather_ms: weatherMs,
        pipeline_ms: pipelineMs,
        server_total_ms: serverTotalMs,
        satellite_observations: bands.length,
      },
      // Which weather host served the recent window: 'primary' (Forecast API),
      // 'auxiliary' (Historical Forecast failover), or 'none' (both down —
      // computed from archive data only).
      weather_status: {
        forecast_source: weather.forecast_source,
        archive_ok: weather.archive_ok,
      },
      _debug: { satellite_observations: bands.length, daily_points: N, params: hasOverrides ? paramOverrides : undefined },
    });
  } catch (error: any) {
    console.error('Nectar V2 error:', error);
    res.status(500).json({ error: 'Failed to calculate V2 Nectar Flow Index: ' + (error.message ?? 'Unknown error') });
  }
}
