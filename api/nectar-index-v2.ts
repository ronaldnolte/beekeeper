import { applyCors, getAuthedUser, getBearerToken, createRateLimiter, getClientIp, isNectarAuthGraceActive, sendUpdateRequired } from './_lib.js';
import { fetchMultiBands } from './_shared/bands-fetcher.js';
import { runV2Pipeline, Phase } from './_shared/nectar-v2-engine.js';
import { fetchWeather as fetchWeatherV2 } from './_shared/weather.js';

// Anonymous nectar calls are only possible during the auth grace window (see
// _lib). Rate-limit them to blunt scripted abuse of the paid Earth Engine /
// weather work while old app builds age out.
const nectarLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

function phaseToStatus(phase: Phase): 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low' {
  switch (phase) {
    case 'IN_FLOW':       return 'Peak Flow';
    case 'FLOW_STARTING': return 'Pre-Flow';
    case 'FLOW_ENDING':   return 'Flow Ending';
    case 'DEARTH':        return 'Dearth';
    default:              return 'Stable Low';
  }
}

function phaseToAdvice(phase: Phase): string {
  switch (phase) {
    case 'IN_FLOW':
      return 'Peak nectar flow is active. Ensure honey supers are in place. Colony is actively storing surplus honey.';
    case 'FLOW_STARTING':
      return 'Nectar flow is building. Queen egg-laying is stimulated. Colony is expanding — watch for swarm preparations.';
    case 'FLOW_ENDING':
      return 'Nectar flow is winding down. Monitor honey stores and watch for robbing behavior as colonies sense the dearth ahead.';
    case 'DEARTH':
      return 'Colony is in a dearth. Monitor food reserves closely. Supplemental feeding may be required to maintain colony strength.';
    default:
      return 'Transitional forage conditions. Monitor colony strength and watch for shifts in the next 1–2 weeks.';
  }
}

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
    // Five years, not three. Measured cost: +0.5 s (12.9 -> 13.4 s), and index values are
    // essentially unchanged. The reason is the SPREAD: three similar seasons produced a
    // standard deviation of 0.06 at South Valley in early May where the true spread is
    // 0.21, which made an ordinary year look like a 5-sigma collapse. Three samples cannot
    // estimate a spread, and a deviation without one is not interpretable.
    const startDate = `${currentYear - 5}-01-01`;
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
      transitionAdvice: phaseToAdvice(latestPhase),
      trend_direction,
      slope: latestSlope,
      v2: result.latest,
      full_history: result.history,
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
