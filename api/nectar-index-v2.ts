// GET /api/nectar-index-v2 — SPEC D §2. Signed-in only (Bearer header). Installed phone
// builds read this exact response shape; keep it identical (CONSTRAINTS §1).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearerToken, handleCors, methodNotAllowed } from './_http.js';
import { getSignedInUser } from './_supabase.js';
import { fetchSatellite } from './_satellite.js';
import { fetchWeather } from './_weather.js';
import { nextPass, runEngine, summarise } from '../shared/nectar/engine.js';
import { todayUtc } from '../shared/nectar/dates.js';

// Old app builds show the raw body as their error (SCAR S-NEC-26).
const UPDATE_MESSAGE =
  'Please update Beekeeper to the latest version (open Google Play and update) to keep using Nectar Flow.';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Tester overrides; invalid values are ignored. `dwell` is accepted but has no effect. */
function parseOverrides(q: VercelRequest['query']) {
  const params: { alpha?: number; rateLag?: number; dwell?: number } = {};
  const alpha = Number(one(q.alpha));
  if (one(q.alpha) !== undefined && alpha > 0 && alpha < 1) params.alpha = alpha;
  const rateLag = Number(one(q.rateLag));
  if (Number.isInteger(rateLag) && rateLag >= 1 && rateLag <= 90) params.rateLag = rateLag;
  const dwell = Number(one(q.dwell));
  if (Number.isInteger(dwell) && dwell >= 1 && dwell <= 30) params.dwell = dwell;
  return Object.keys(params).length ? params : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  const started = Date.now();

  try {
    // Sign-in is required; the old anonymous grace path is gone (Ron, 2026-09-25).
    const auth = await getSignedInUser(bearerToken(req));
    if (!auth) {
      res.status(401).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(UPDATE_MESSAGE);
    }

    const latRaw = one(req.query.lat);
    const lngRaw = one(req.query.lng);
    if (!latRaw || !lngRaw) return res.status(400).json({ error: 'lat and lng are required' });
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    // Window: five full prior years + the current year to date, or a replayed past season.
    const today = todayUtc();
    const thisYear = +today.slice(0, 4);
    const y = Number(one(req.query.year));
    const reviewYear = Number.isInteger(y) && y >= 2022 && y < thisYear ? y : null;
    const anchor = reviewYear ?? thisYear;
    const start = `${anchor - 5}-01-01`;
    const end = reviewYear ? `${reviewYear}-12-31` : today;
    const overrides = parseOverrides(req.query);

    const timed = async <T>(p: Promise<T>) => {
      const t = Date.now();
      const value = await p;
      return { value, ms: Date.now() - t };
    };
    const [sat, wx] = await Promise.all([
      timed(fetchSatellite(lat, lng, start, end)),
      timed(fetchWeather(lat, lng, start, end, today)),
    ]);
    if (sat.value.records.length === 0) throw new Error('Earth Engine returned no vegetation data for this location.');

    const t = Date.now();
    const result = runEngine(sat.value.records, wx.value.map, lat, {
      windowEnd: end,
      alpha: overrides?.alpha,
      rateLag: overrides?.rateLag,
    });
    if (!result || result.dates.length === 0) throw new Error('V2 pipeline produced no output.');
    const summary = summarise(result);
    const pipelineMs = Date.now() - t;

    const { passDates, records } = sat.value;
    const body = {
      ...summary,
      satellite: {
        last_pass: passDates[passDates.length - 1] ?? null,
        last_image: records[records.length - 1].date,
        next_pass: nextPass(passDates),
        pass_count: passDates.length,
        image_count: records.length,
      },
      _timing: {
        earth_engine_ms: sat.ms,
        weather_ms: wx.ms,
        pipeline_ms: pipelineMs,
        server_total_ms: Date.now() - started,
        satellite_observations: records.length,
      },
      weather_status: { forecast_source: wx.value.forecast_source, archive_ok: wx.value.archive_ok },
      _debug: {
        satellite_observations: records.length,
        daily_points: result.dates.length,
        ...(overrides ? { params: overrides } : {}),
      },
    };

    // Browser-only cache; never shared, because the sign-in check must run (SCAR S-NEC-26).
    if (!overrides) res.setHeader('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    return res.status(200).json(body);
  } catch (err) {
    console.error('[nectar-index-v2]', err);
    return res.status(500).json({ error: 'Failed to calculate V2 Nectar Flow Index: ' + (err as Error).message });
  }
}
