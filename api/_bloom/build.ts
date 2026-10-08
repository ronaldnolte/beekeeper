// Builds the stored form of an apiary's bloom table (one apiary_bloom row, see
// supabase/migrations/0013_apiary_bloom.sql) from the Bloom workshop port in presence.ts + table.ts.
//
// Only what does not change day to day is stored: which plants are nearby and their normal-year
// start and end as month-day. Today's status is worked out in the app from those dates, so the row
// stays right all year and every year without a rebuild.

import { findNearbyPlants } from './presence.js';
import { buildBloomTable, normalHeat, yieldOf } from './table.js';
import { FORAGE_MASTER } from './forageMaster.js';
import type { GetJson } from './types.js';

/** Years averaged for "normal" heat — the Bloom workshop's default. */
export const NORMAL_YEARS: [number, number] = [2016, 2025];

// Dates are laid out on a non-leap year so a day-of-year always lands on the same month-day.
const LAYOUT_YEAR = 2025;

/** One nearby plant as stored; `plant` is its ID (common name) in the master list. */
export interface StoredBloomPlant {
  plant: string;
  presence: string;
  trigger: string;
  start: string | null; // 'MM-DD'; null when the plant is not expected to bloom in a normal year
  end: string | null;
  note: string;
}

export interface StoredBloom {
  built_lat: number;
  built_lon: number;
  radius_mi: number;
  limited: boolean;
  warning: string | null;
  normal_years: string;
  normal_heat_year_end: number;
  plants: StoredBloomPlant[];
}

/**
 * Daymet (the normal-heat source) covers North America only. Outside it the bloom section is hidden
 * rather than shown wrong (decided Aug 2026; one user is in Lithuania). A generous box around
 * Daymet's grid; a point inside the box but off the grid (e.g. open sea) fails at Daymet and is
 * reported as unavailable.
 */
export function inBloomCoverage(lat: number, lon: number): boolean {
  return lat >= 14 && lat <= 83 && lon >= -179 && lon <= -52;
}

/** What the app shows for a plant, looked up from the master list at answer time (not stored). */
export interface BloomPlantInfo {
  scientific: string;
  kind: 'nectar' | 'pollen' | 'both'; // the colour and the label in the app
  nectar: number; // 0-3
  pollen: number; // 0-3
}

const MASTER_BY_ID = new Map(FORAGE_MASTER.plants.map((p) => [p.common, p]));

/** Stored plants plus their master-list details; a plant no longer in the master list is left out. */
export function withPlantInfo(plants: StoredBloomPlant[]): (StoredBloomPlant & BloomPlantInfo)[] {
  return plants.flatMap((s) => {
    const p = MASTER_BY_ID.get(s.plant);
    if (!p) return [];
    const y = yieldOf(p.nectar, p.pollen); // the workshop's Both / Nectar / Pollen / Both (minor)
    const kind = y === 'Nectar' ? 'nectar' : y === 'Pollen' ? 'pollen' : 'both';
    return [{ ...s, scientific: p.names.join('; '), kind, nectar: p.nectar, pollen: p.pollen }];
  });
}

export async function buildApiaryBloom(lat: number, lon: number, getJson: GetJson): Promise<StoredBloom> {
  const [site, heat] = await Promise.all([
    findNearbyPlants(lat, lon, FORAGE_MASTER.plants, getJson),
    normalHeat(lat, lon, Array.from({ length: NORMAL_YEARS[1] - NORMAL_YEARS[0] + 1 }, (_, i) => NORMAL_YEARS[0] + i), getJson),
  ]);
  const table = buildBloomTable(lat, lon, site, FORAGE_MASTER.plants, heat, new Date(Date.UTC(LAYOUT_YEAR, 0, 1)), { normalYears: NORMAL_YEARS });
  const md = (d: string) => (d ? d.slice(5) : null);
  return {
    built_lat: lat,
    built_lon: lon,
    radius_mi: table.radiusMi,
    limited: table.limited,
    warning: table.warning,
    normal_years: table.normalYears,
    normal_heat_year_end: table.normalHeatYearEnd,
    plants: table.plants.map((r) => ({ plant: r.plant, presence: r.presence, trigger: r.trigger, start: md(r.start), end: md(r.end), note: r.note })),
  };
}
