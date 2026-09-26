// The nectar endpoint end to end, offline: sign-in, satellite and weather are replaced by the
// live-fetcher fixtures, and the clock is pinned to 2026-09-25. The response must equal the
// live answer key (golden/nectar-live), including the satellite block.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const G = join(__dirname, 'golden');
const json = (p: string) => JSON.parse(readFileSync(join(G, p), 'utf8'));
const SITES: Record<string, string> = { '35.1065,-106.3623': 'tijeras', '35.0385,-106.7066': 'south_valley', '35.7963,-86.3738': 'murfreesboro' };
const siteAt = (lat: number, lon: number) => SITES[`${lat},${lon}`];

vi.mock('../api/_supabase.js', () => ({
  getSignedInUser: async (token: string | null) => (token === 'good' ? { user: { id: 'u1' }, client: {} } : null),
}));
vi.mock('../api/_satellite.js', () => ({
  fetchSatellite: async (lat: number, lon: number, start: string, end: string) => {
    expect([start, end]).toEqual(['2021-01-01', '2026-09-25']);
    const b = json(`fixtures-live/bands_${siteAt(lat, lon)}.json`);
    return { passDates: b.passDates, records: b.records };
  },
}));
vi.mock('../api/_weather.js', () => ({
  fetchWeather: async (lat: number, lon: number) => {
    const w = json(`fixtures-live/weather_${siteAt(lat, lon)}.json`);
    return { map: w.map, forecast_source: w.forecast_source, archive_ok: w.archive_ok };
  },
}));

const { default: handler } = await import('../api/nectar-index-v2.js');

function call(query: Record<string, string>, headers: Record<string, string> = {}, method = 'GET') {
  const out: { status: number; headers: Record<string, string>; body: unknown } = { status: 200, headers: {}, body: undefined };
  const res = {
    status(c: number) {
      out.status = c;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    send(b: unknown) {
      out.body = b;
      return res;
    },
    end() {
      return res;
    },
  };
  const req = { method, query, headers };
  return Promise.resolve(handler(req as unknown as VercelRequest, res as unknown as VercelResponse)).then(() => out);
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T18:00:00Z'));
});
afterAll(() => vi.useRealTimers());

describe('GET /api/nectar-index-v2', () => {
  it('answers an unsigned request with the plain-text update message', async () => {
    const r = await call({ lat: '35.1065', lng: '-106.3623' });
    expect(r.status).toBe(401);
    expect(r.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(r.body).toBe('Please update Beekeeper to the latest version (open Google Play and update) to keep using Nectar Flow.');
  });

  it('validates coordinates', async () => {
    const auth = { authorization: 'Bearer good' };
    expect(await call({ lat: '35' }, auth)).toMatchObject({ status: 400, body: { error: 'lat and lng are required' } });
    expect(await call({ lat: 'x', lng: 'y' }, auth)).toMatchObject({ status: 400, body: { error: 'lat and lng must be valid numbers' } });
  });

  it('rejects other methods and answers preflight', async () => {
    expect(await call({}, {}, 'POST')).toMatchObject({ status: 405, body: { error: 'Method not allowed' } });
    const pre = await call({}, { origin: 'https://localhost' }, 'OPTIONS');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('https://localhost');
    const other = await call({}, { origin: 'https://evil.example' }, 'OPTIONS');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  for (const [coords, site] of Object.entries(SITES)) {
    it(`matches the live answer key for ${site}`, async () => {
      const [lat, lng] = coords.split(',');
      const r = await call({ lat, lng, _d: '2026-09-25' }, { authorization: 'bearer good' });
      expect(r.status).toBe(200);
      expect(r.headers['cache-control']).toBe('private, max-age=3600, stale-while-revalidate=600');
      const body = r.body as Record<string, unknown>;
      const want = json(`nectar-live/${site}.live-2026-09-25.response.json`);
      expect(Math.abs((body.slope as number) - want.slope)).toBeLessThan(1e-9);
      for (const k of ['nfi', 'phase', 'status', 'trend_direction', 'v2', 'full_history', 'satellite']) {
        expect(body[k], k).toEqual(want[k]);
      }
      expect(body.weather_status).toEqual({ forecast_source: 'primary', archive_ok: true });
      expect(Object.keys(body._timing as object).sort()).toEqual(
        ['earth_engine_ms', 'pipeline_ms', 'satellite_observations', 'server_total_ms', 'weather_ms'],
      );
      expect(body._debug).toEqual({ satellite_observations: want.satellite.image_count, daily_points: want.full_history.length });
    });
  }

  it('marks tester overrides and does not cache them', async () => {
    const r = await call({ lat: '35.1065', lng: '-106.3623', alpha: '0.2', dwell: '5' }, { authorization: 'Bearer good' });
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBeUndefined();
    expect((r.body as { _debug: { params: unknown } })._debug.params).toEqual({ alpha: 0.2, dwell: 5 });
  });
});
