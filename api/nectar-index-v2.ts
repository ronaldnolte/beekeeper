import { fetchMultiBands } from './bands-fetcher.js';
import { runV2Pipeline, Phase, WeatherDay } from './nectar-v2-engine.js';

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

async function fetchWeatherV2(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<Record<string, WeatherDay>> {
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
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${base}&start_date=${recentStart}&end_date=${endDate}&${dailyVars}&${hourlyVars}`;

  const [archRes, fcRes] = await Promise.all([fetch(archiveUrl), fetch(forecastUrl)]);
  if (archRes.ok) {
    const j = await archRes.json();
    absorbDaily(j.daily ?? null);
    absorbHourlyDew(j.hourly ?? null);
  }
  if (fcRes.ok) {
    const j = await fcRes.json();
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
  return out;
}

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { lat: latRaw, lng: lngRaw, alpha: alphaRaw, rateLag: rateLagRaw, dwell: dwellRaw, riseThr: riseThrRaw, wFall: wFallRaw } = req.query;
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
  if (riseThrRaw) { const v = parseFloat(riseThrRaw); if (!isNaN(v) && v > 0 && v <= 0.1) paramOverrides.riseThr = v; }
  if (wFallRaw != null) { const v = parseFloat(wFallRaw); if (!isNaN(v) && v >= 0 && v <= 2)   paramOverrides.wFall   = v; }
  const hasOverrides = Object.keys(paramOverrides).length > 0;

  try {
    const startDate = '2023-01-01';
    const endDate = new Date().toISOString().slice(0, 10);

    const [bands, weatherMap] = await Promise.all([
      fetchMultiBands(lat, lng, startDate, endDate),
      fetchWeatherV2(lat, lng, startDate, endDate),
    ]);

    if (bands.length === 0) {
      throw new Error('Earth Engine returned no vegetation data for this location.');
    }

    const result = runV2Pipeline(bands, weatherMap, lat, paramOverrides);

    const N = result.dates.length;
    if (N === 0) throw new Error('V2 pipeline produced no output.');

    const li = N - 1;
    const latestEwma = result.idxEwma[li];
    const latestPhase = result.phases[li];
    const latestSlope = result.slopeArr[li] ?? 0;
    const nfi = Math.round(latestEwma * 100);
    const trend_direction: 'rising' | 'falling' | 'flat' =
      latestSlope > 0.002 ? 'rising' : latestSlope < -0.002 ? 'falling' : 'flat';

    // Skip CDN cache when params are being tuned so each combination is fresh
    if (req.method === 'GET' && !hasOverrides) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
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
      _debug: { satellite_observations: bands.length, daily_points: N, params: hasOverrides ? paramOverrides : undefined },
    });
  } catch (error: any) {
    console.error('Nectar V2 error:', error);
    res.status(500).json({ error: 'Failed to calculate V2 Nectar Flow Index: ' + (error.message ?? 'Unknown error') });
  }
}
