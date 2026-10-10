// Which master forage plants occur within bee flight range of an apiary?
// A line-for-line port of apiaryForage.mjs (Ron's Bloom workshop, E:\Bloom) — same requests, same rules,
// same output — minus file writing and console output. The web request function is passed in so the
// parity test can replay recorded GBIF answers. See api/__tests__/bloom-parity.test.ts.
//
// Presence rules: records in the chosen circle >= likelyMin "Likely", 1..likelyMin-1 "Possible"; none there
// but some in the largest circle "Possible (wider area)"; none anywhere "Not found".

import type { ForagePlant, GetJson, PresenceResult, PresenceRow } from './types.js';

export const GBIF_API = 'https://api.gbif.org/v1';
const FILTERS = 'hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT';

export interface PresenceOptions {
  radii?: number[]; // circle sizes to try, smallest first (default 3,5,8,10,15)
  targetLikely?: number; // stop at the first circle with this many "Likely" plants (default 40)
  limitedBelow?: number; // fewer Likely plants than this even at the largest circle -> limited (default 20)
  likelyMin?: number; // records needed in the chosen circle to call a plant "Likely" (default 5)
}

// Circle polygon (WKT) around a point. Counter-clockwise, as GBIF requires.
export function circleWkt(lat: number, lon: number, radiusMi: number, points = 36): string {
  const R = 3958.8; // miles
  const dLat = (radiusMi / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (2 * Math.PI * i) / points;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return 'POLYGON((' + ring.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(',') + '))';
}

export function presence(countMain: number, countWide: number, likelyMin: number): string {
  if (countMain >= likelyMin) return 'Likely';
  if (countMain >= 1) return 'Possible';
  if (countWide >= 1) return 'Possible (wider area)';
  return 'Not found';
}

type Counts = Map<number, number> & { names?: Map<string, number> };

// Record counts for every species and genus inside a circle, plus counts by species name, in one request.
async function countsIn(wkt: string, getJson: GetJson): Promise<Counts> {
  const limit = 20000;
  const j = await getJson(`${GBIF_API}/occurrence/search?kingdomKey=6&geometry=${encodeURIComponent(wkt)}&${FILTERS}&limit=0&facet=speciesKey&facet=genusKey&facet=scientificName&facetLimit=${limit}`);
  const counts: Counts = new Map();
  const names = new Map<string, number>();
  for (const f of j.facets) {
    if (f.counts.length >= limit) throw new Error(`More than ${limit} ${f.field} values in the circle; raise facetLimit`);
    for (const c of f.counts) {
      if (f.field !== 'SCIENTIFIC_NAME') { counts.set(+c.name, c.count); continue; }
      const [g, s] = c.name.split(' '); // "Ulmus pumila L." and "Opuntia phaeacantha var. major" -> "Ulmus pumila", "Opuntia phaeacantha"
      if (s && /^[a-z-]+$/.test(s)) names.set(`${g} ${s}`, (names.get(`${g} ${s}`) || 0) + c.count);
    }
  }
  counts.names = names;
  return counts;
}

export async function findNearbyPlants(
  lat: number,
  lon: number,
  plants: ForagePlant[],
  getJson: GetJson,
  opts: PresenceOptions = {}
): Promise<PresenceResult> {
  const radii = [...(opts.radii ?? [3, 5, 8, 10, 15])].sort((a, b) => a - b);
  const targetLikely = opts.targetLikely ?? 40;
  const limitedBelow = opts.limitedBelow ?? 20;
  const likelyMin = opts.likelyMin ?? 5;
  const keysOf = (p: ForagePlant) => p.names.map((n) => p.gbif?.[n]).filter(Boolean);

  // A species with its own entry is left out of its genus entry (e.g. almond out of "Wild plums and other Prunus").
  const genusEntry = new Map(plants.flatMap((p) => p.names.filter((n) => !n.includes(' ')).map((n) => [n, p] as [string, ForagePlant])));
  const carvedOut = new Map<string, number[]>(); // genus name -> species keys that belong to other entries
  const speciesOwner = new Map<string, ForagePlant>(); // species name -> its own entry, under both the master name and GBIF's accepted name
  for (const p of plants) for (const n of p.names.filter((x) => x.includes(' '))) {
    const g = genusEntry.get(n.split(' ')[0]);
    if (!g || g === p || !p.gbif?.[n]) continue;
    carvedOut.set(n.split(' ')[0], [...(carvedOut.get(n.split(' ')[0]) || []), p.gbif[n]]);
    speciesOwner.set(n, p);
    const accepted = (await getJson(`${GBIF_API}/species/${p.gbif[n]}`)).canonicalName;
    if (accepted) speciesOwner.set(accepted, p);
  }
  for (const p of plants) for (const n of p.names.filter((x) => x.includes(' '))) if (!speciesOwner.has(n)) speciesOwner.set(n, p);
  const sum = (m: Counts, p: ForagePlant) => p.names.reduce((s, n) => {
    const k = p.gbif?.[n];
    if (!k) return s;
    const own = (m.get(k) || 0) - (carvedOut.get(n) || []).reduce((t, sk) => t + (m.get(sk) || 0), 0);
    return s + Math.max(0, own);
  }, 0);
  // Which species inside a group entry were actually recorded, most records first.
  const speciesFound = (m: Counts, p: ForagePlant) => {
    if (p.names.length === 1 && p.names[0].includes(' ')) return [];
    const out: { name: string; count: number }[] = [];
    for (const [name, count] of m.names || []) {
      const owner = speciesOwner.get(name) || genusEntry.get(name.split(' ')[0]);
      if (owner === p) out.push({ name, count });
    }
    return out.sort((a, b) => b.count - a.count);
  };

  // Grow the circle until enough plants are "Likely"; sparse GBIF areas need a wider look.
  let radius = radii[0];
  let mainC: Counts = new Map();
  let likely = 0;
  for (radius of radii) {
    mainC = await countsIn(circleWkt(lat, lon, radius), getJson);
    likely = plants.filter((p) => sum(mainC, p) >= likelyMin).length;
    if (likely >= targetLikely) break;
  }
  const wide = radii[radii.length - 1];
  const wideC: Counts = wide > radius ? await countsIn(circleWkt(lat, lon, wide), getJson) : new Map();

  const rows: PresenceRow[] = plants.map((p) => {
    const recordsMain = sum(mainC, p), recordsWide = recordsMain ? 0 : sum(wideC, p);
    return {
      plant: p.common, scientific: p.names.join('; '), nectar: p.nectar, pollen: p.pollen, bloomNational: p.bloom,
      recordsMain, recordsWide,
      speciesFound: speciesFound(recordsMain ? mainC : wideC, p),
      presence: keysOf(p).length ? presence(recordsMain, recordsWide, likelyMin) : 'No GBIF match',
      cropCheck: !!p.crop,
    };
  });
  const order: Record<string, number> = { 'Likely': 0, 'Possible': 1, 'Possible (wider area)': 2, 'Not found': 3, 'No GBIF match': 4 };
  rows.sort((a, b) => order[a.presence] - order[b.presence] || b.recordsMain - a.recordsMain);

  // Sparse areas (often farm and ranch country) give short lists; say so rather than pretend.
  const limited = likely < limitedBelow;
  const warning = limited
    ? `Limited plant list: only ${likely} plants are well recorded within ${radius} miles. Few people record plants in this area, and crop fields (such as canola, alfalfa or sunflower) are not counted, so important forage may be missing.`
    : null;
  return { lat, lon, radiusMi: radius, fallbackRadiusMi: wide, targetLikely, limited, warning, plants: rows };
}
