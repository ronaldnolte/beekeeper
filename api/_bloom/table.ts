// An apiary's bloom table: each nearby plant's bloom window as local calendar dates in a normal year, plus the
// bell-curve status for a date. A line-for-line port of apiaryTable.mjs and the pieces of bloomWindows.mjs it
// uses (Ron's Bloom workshop, E:\Bloom) — same rules, same numbers — minus file writing and console output.
// The web request function is passed in so the parity test can replay recorded Daymet answers.
//
// Heat: base 32 F, no cap, counted from 1 January; each day (high + low) / 2 in F minus 32, never below 0; a missing
// day reuses the previous day's average. Heat floor (Ron, 2026-10-08): no heat plant starts before the year's heat
// reaches 400, so a warm winter spell cannot start spring bloom. This is cumulative-from-January heat — a different
// measure from the Nectar index's trailing 30-day gate (api/_nectar-v2-engine.ts).

import type { BloomRow, BloomTable, ForagePlant, GetJson, PresenceResult } from './types.js';

export const GDD_BASE = 32; // deg F; bloom heat is counted from the same base as the Bloom workshop
export const DAYMET_API = 'https://daymet.ornl.gov/single-pixel/api/data';

export const SETTINGS = { divisor: 4, minSpread: 3, inBloom: 0.5, lookahead: 14, windingFloor: 0.15, minWindow: 21, maxWindow: 90, defaultWindow: 30, heatFloor: 400 };

export interface TableOptions {
  include?: 'likely' | 'possible' | 'all'; // default 'all'
  normalYears?: [number, number]; // default [2016, 2025]
  minForage?: number; // leave out plants scoring below this for both nectar and pollen (default 2; toxic kept)
  heatFloor?: number; // default SETTINGS.heatFloor
  wideMin?: number; // wider-area plants need at least this many records (default 3)
}

// Day length in hours from latitude and day of year (standard astronomical formula, sunrise to sunset).
export function dayLength(lat: number, doy: number): number {
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81)) * (Math.PI / 180);
  const x = -Math.tan((lat * Math.PI) / 180) * Math.tan(decl) + Math.sin((-0.833 * Math.PI) / 180) / (Math.cos((lat * Math.PI) / 180) * Math.cos(decl));
  return (24 / Math.PI) * Math.acos(Math.max(-1, Math.min(1, x)));
}

// Normal cumulative heat by day of year at a point, averaged over several years (Daymet, 365 days per year).
export async function normalHeat(lat: number, lon: number, years: number[], getJson: GetJson): Promise<number[]> {
  const j = await getJson(`${DAYMET_API}?lat=${lat}&lon=${lon}&vars=tmax,tmin&years=${years.join(',')}&format=json`);
  const d = j.data, kx = Object.keys(d).find((k) => k.startsWith('tmax'))!, kn = Object.keys(d).find((k) => k.startsWith('tmin'))!;
  const byYear: Record<string, number[]> = {};
  let prev: number | null = null;
  d.year.forEach((y: number, i: number) => {
    if (!byYear[y]) { byYear[y] = []; prev = null; }
    const hi = d[kx][i], lo = d[kn][i];
    const avg: number | null = Number.isFinite(hi) && Number.isFinite(lo) ? ((hi + lo) / 2) * 1.8 + 32 : prev;
    prev = avg;
    byYear[y].push((byYear[y].at(-1) ?? 0) + Math.max(0, (avg ?? GDD_BASE) - GDD_BASE));
  });
  const ys = Object.values(byYear);
  return Array.from({ length: 365 }, (_, i) => ys.reduce((s, a) => s + a[i], 0) / ys.length);
}

function lodStart(lat: number, hours: number, direction: string | undefined): number | null {
  const [from, to] = direction === 'lengthening' ? [1, 172] : [173, 365];
  const max = dayLength(lat, 172);
  if (direction === 'lengthening' ? max < hours : max <= hours) return null; // never reached at this latitude
  for (let d = from; d <= to; d++) {
    const dl = dayLength(lat, d);
    if (direction === 'lengthening' ? dl >= hours : dl <= hours) return d;
  }
  return null;
}

export function bloomRate(doy: number, start: number, end: number): number {
  const peak = (start + end) / 2, sd = Math.max(SETTINGS.minSpread, (end - start) / SETTINGS.divisor);
  return Math.exp(-0.5 * ((doy - peak) / sd) ** 2);
}

export function status(doy: number, start: number, end: number): string {
  const peak = (start + end) / 2, r = bloomRate(doy, start, end);
  if (r >= SETTINGS.inBloom) return 'May be in bloom';
  if (doy < peak) return bloomRate(doy + SETTINGS.lookahead, start, end) >= SETTINGS.inBloom ? 'Starting soon' : 'Not yet';
  return r >= SETTINGS.windingFloor ? 'Winding down' : 'Finished';
}

export const yieldOf = (n: number, p: number) => (n >= 2 && p >= 2 ? 'Both' : n > p ? 'Nectar' : p > n ? 'Pollen' : 'Both (minor)');
export const toDate = (year: number, doy: number) => new Date(Date.UTC(year, 0, Math.round(doy))).toISOString().slice(0, 10);

/** Builds the table from a presence result, the master plants and the point's normal heat curve. */
export function buildBloomTable(
  lat: number,
  lon: number,
  site: PresenceResult,
  masterPlants: ForagePlant[],
  heat: number[],
  asOf: Date,
  opts: TableOptions = {}
): BloomTable {
  const year = asOf.getUTCFullYear(), today = Math.floor((asOf.getTime() - Date.UTC(year, 0, 0)) / 86400000);
  const [y0, y1] = opts.normalYears ?? [2016, 2025];
  const heatFloor = opts.heatFloor ?? SETTINGS.heatFloor;
  const include = { likely: ['Likely'], possible: ['Likely', 'Possible'], all: ['Likely', 'Possible', 'Possible (wider area)'] }[opts.include ?? 'all'];
  const wideMin = opts.wideMin ?? 3;
  const master = Object.fromEntries(masterPlants.map((p) => [p.common, p]));

  const rows: (BloomRow & { _start: number })[] = [];
  // Low producers (nectar and pollen both under minForage) are left out; toxic warning entries always stay.
  const minForage = opts.minForage ?? 2;
  const keep = (p: ForagePlant) => p.nectar >= minForage || p.pollen >= minForage || /TOXIC/.test(p.notes || '');
  for (const s of site.plants.filter((r) => include.includes(r.presence) && (r.presence !== 'Possible (wider area)' || r.recordsWide >= wideMin) && keep(master[r.plant]))) {
    const p = master[s.plant], b = p.bloomData;
    let start: number | null = null, note = '';
    const gbif = b.source !== 'USA-NPN';
    // Start: site-season start (earliest flower at a site) when available, else a typical plant's first bloom.
    const season = !gbif && b.seasonLengthDays;
    if (b.trigger === 'GDD') {
      const own = (season && b.seasonStartGdd?.[1]) ?? b.onsetGdd![1];
      const thr = Math.max(own as number, heatFloor);
      const i = heat.findIndex((v) => v >= thr);
      if (i < 0) { note = `Normal heat here (${Math.round(heat[364])}) never reaches this plant's bloom heat (${thr}); may not bloom in a normal year`; }
      else start = i + 1;
      if (start != null && (own as number) < heatFloor) note = `Start held to the heat floor (${heatFloor}); plant's own start heat is ${own}`;
    } else {
      start = season ? lodStart(lat, b.seasonStartDaylengthHrs![1], b.seasonStartDirection) : lodStart(lat, b.onsetDaylengthThresholdHrs!, b.daylengthDirection);
      if (start == null) { start = (season ? b.seasonStartDoy! : (b.onsetDoy || b.floweringDoy)!)[1]; note = 'Day-length threshold not reached at this latitude; national typical date used'; }
    }
    let end: number | null = null;
    if (start != null) {
      if (gbif) { // threshold = middle of flowering; half-width from the national spread, kept within 10-45 days
        const half = Math.min(45, Math.max(10, (b.floweringDoy![2] - b.floweringDoy![0]) / 4));
        [start, end] = [start - half, start + half];
      } else if (season) {
        // End: start + the typical site season length (days). End heat is not used: it comes from the hottest sites
        // and cooler places may never reach it.
        end = start + Math.max(SETTINGS.minWindow, b.seasonLengthDays![1]);
      } else {
        // No site-season data: a long individual bloom (90th percentile), kept within 21-90 days (30 if unknown).
        end = start + Math.min(SETTINGS.maxWindow, Math.max(SETTINGS.minWindow, b.durationDays?.[2] ?? SETTINGS.defaultWindow));
        note = [note, b.durationDays ? 'No site-season data; season length estimated' : 'No flowering-length data; 30-day season assumed'].filter(Boolean).join('. ');
      }
      start = Math.max(1, Math.round(start)); end = Math.min(365, Math.round(end));
    }
    rows.push({
      plant: p.common, scientific: p.names.join('; '), presence: s.presence, trigger: b.trigger,
      start: start != null ? toDate(year, start) : '', end: end != null ? toDate(year, end) : '',
      peak: start != null ? toDate(year, (start + end!) / 2) : '', dateAdjustment: 0,
      bloomRate: start != null ? +bloomRate(today, start, end!).toFixed(3) : 0,
      status: start != null ? status(today, start, end!) : 'Not expected',
      yield: yieldOf(p.nectar, p.pollen), nectar: p.nectar, pollen: p.pollen,
      confidence: b.confidence, source: b.source, note: [note, p.crop ? 'Crop; check cropland' : '', /TOXIC/.test(p.notes || '') ? p.notes : ''].filter(Boolean).join('. '),
      _start: start ?? 999,
    });
  }
  rows.sort((a, c) => a._start - c._start);
  const plants: BloomRow[] = rows.map(({ _start, ...r }) => r);

  return { lat, lon, asOf: toDate(year, today), normalYears: `${y0}-${y1}`, normalHeatYearEnd: Math.round(heat[364]), gddBaseF: GDD_BASE, radiusMi: site.radiusMi, limited: site.limited, warning: site.warning, plants };
}
