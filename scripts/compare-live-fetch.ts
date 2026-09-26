// Compares a fresh satellite + weather fetch with the live-fetcher answer key
// (tests/golden/fixtures-live, fetched 2026-09-25 by the shipped fetcher).
// Run: npx tsx --env-file=.env.local scripts/compare-live-fetch.ts [site ...]
// Uses paid Earth Engine calls — one per site.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchSatellite } from '../api/_satellite.js';
import { fetchWeather } from '../api/_weather.js';
import { runEngine, summarise } from '../shared/nectar/engine.js';

const DIR = join(import.meta.dirname, '..', 'tests', 'golden');
const json = (p: string) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const START = '2021-01-01';
const END = '2026-09-25'; // the answer key's "today"

async function compareSite(site: string) {
  const bands = json(`fixtures-live/bands_${site}.json`);
  const weatherKey = json(`fixtures-live/weather_${site}.json`);
  const { lat, lon } = bands.site;
  console.log(`\n=== ${site} (${lat}, ${lon})`);

  const t0 = Date.now();
  const [sat, wx] = await Promise.all([fetchSatellite(lat, lon, START, END), fetchWeather(lat, lon, START, END, END)]);
  console.log(`fetched in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // Satellite
  const kp: string[] = bands.passDates;
  const kr = bands.records as { date: string; ndvi: number; evi: number; ndwi: number }[];
  const newPasses = sat.passDates.filter(d => !kp.includes(d));
  const lostPasses = kp.filter(d => !sat.passDates.includes(d));
  console.log(`passes: key ${kp.length}, fresh ${sat.passDates.length}; new ${newPasses.length} ${newPasses.slice(0, 5)}; missing ${lostPasses.length} ${lostPasses.slice(0, 5)}`);
  console.log(`records: key ${kr.length}, fresh ${sat.records.length}`);
  let maxDiff = 0;
  let orderMismatch = 0;
  const n = Math.min(kr.length, sat.records.length);
  for (let i = 0; i < n; i++) {
    const a = kr[i];
    const b = sat.records[i];
    if (a.date !== b.date) {
      orderMismatch++;
      continue;
    }
    maxDiff = Math.max(maxDiff, Math.abs(a.ndvi - b.ndvi), Math.abs(a.evi - b.evi), Math.abs(a.ndwi - b.ndwi));
  }
  console.log(`records compared position by position: date mismatches ${orderMismatch}, largest value difference ${maxDiff}`);

  // Weather
  const km = weatherKey.map as Record<string, { tmax: number; tmin: number; dew?: number }>;
  const keys = Object.keys(km);
  let wDiff = 0;
  let wDiffDays = 0;
  const diffDates: string[] = [];
  for (const d of keys) {
    const a = km[d];
    const b = wx.map[d];
    if (!b) {
      wDiffDays++;
      continue;
    }
    const diff = Math.max(Math.abs(a.tmax - b.tmax), Math.abs(a.tmin - b.tmin), Math.abs((a.dew ?? 0) - (b.dew ?? 0)));
    if (diff > 0) { wDiffDays++; diffDates.push(d); }
    wDiff = Math.max(wDiff, diff);
  }
  console.log(
    `weather: key ${keys.length} days, fresh ${Object.keys(wx.map).length}; days differing ${wDiffDays}, largest difference ${wDiff}; source ${wx.forecast_source}, archive ${wx.archive_ok}`,
  );

  if (diffDates.length) console.log(`weather days differing: ${diffDates[0]} … ${diffDates[diffDates.length - 1]}`);

  // Engine on fresh data vs the live answer
  const want = json(`nectar-live/${site}.live-2026-09-25.response.json`);
  const got = summarise(runEngine(sat.records, wx.map, lat, { windowEnd: END })!);
  console.log(`engine: NFI ${got.nfi} (key ${want.nfi}), phase ${got.phase} (key ${want.phase}), trend ${got.trend_direction} (key ${want.trend_direction})`);
  let histDiff = 0;
  got.full_history.forEach((h, i) => {
    if (want.full_history[i]?.forage_index_smoothed !== h.forage_index_smoothed) histDiff++;
  });
  console.log(`history days differing from key: ${histDiff} of ${got.full_history.length}`);
}

const sites = process.argv.slice(2);
for (const s of sites.length ? sites : ['tijeras']) await compareSite(s);
