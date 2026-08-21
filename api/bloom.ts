import { applyCors, getAuthedUser, getBearerToken, fetchFirstOk } from './_lib.js';
import {
  DAY_MS, dayOfYearUTC, mmddToDoy, seasonOffsetDays, statusFor, type BloomStatus,
} from './_shared/season.js';

// What should be blooming near an apiary right now.
//
// Deliberately does NOT touch Earth Engine: it reads the ecoregion already cached on the
// apiary row and needs only Open-Meteo temperatures, so it stays fast enough to sit on the
// dashboard. The nectar index takes ~18 s; this should take about one.
//
// The season maths lives in _shared/season.ts — pure, no I/O, unit-tested there. The short
// version: bloom windows in zone_plants are calendar priors, and a fixed calendar is blind
// to the year actually happening (Albuquerque hit 90F in March 2026 and bloom ran weeks
// early). Rather than per-species GDD thresholds, which are not populated yet, we derive a
// whole-season offset from accumulated warmth and slide every window by it.
//
// Nectar only. Pollen sources are excluded by design — a beekeeper can watch pollen come in
// at the entrance, but not nectar, so reporting pollen adds noise rather than information.

interface ZonePlant {
  bloom_start: string | null;
  bloom_peak: string | null;
  bloom_end: string | null;
  nectar_value: number | null;
  source: string;
  confidence: string | null;
  plants: { common_name: string; scientific_name: string | null; photo_url: string | null } | null;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const auth = await getAuthedUser(getBearerToken(req));
  if (!auth) { res.status(401).json({ error: 'You must be signed in.' }); return; }

  const apiaryId = req.body?.apiaryId;
  if (!apiaryId || typeof apiaryId !== 'string') {
    res.status(400).json({ error: 'apiaryId is required' });
    return;
  }

  try {
    const { data: apiary, error } = await auth.supabase
      .from('apiaries')
      .select('id, latitude, longitude, ecoregion_l3, ecoregion_l4, ecoregion_resolved_at, ecoregion_source')
      .eq('id', apiaryId)
      .single();

    if (error || !apiary) { res.status(404).json({ error: 'Apiary not found' }); return; }

    if (!apiary.ecoregion_resolved_at) {
      // The caller should hit /api/apiary-zone first; that is where the Earth Engine cost lives.
      res.status(200).json({ available: false, reason: 'zone-not-resolved', plants: [] });
      return;
    }
    if (!apiary.ecoregion_l3 && !apiary.ecoregion_l4) {
      // Outside the conterminous US. The feature is hidden rather than degraded.
      res.status(200).json({ available: false, reason: 'outside-coverage', plants: [] });
      return;
    }

    // Level IV first; fall back to Level III so an uncurated fine zone still gets a list.
    const select = 'bloom_start, bloom_peak, bloom_end, nectar_value, source, confidence, plants(common_name, scientific_name, photo_url)';
    let zoneLevel = 'l4';
    let zoneCode = apiary.ecoregion_l4;
    let rows: ZonePlant[] = [];

    if (zoneCode) {
      const { data } = await auth.supabase.from('zone_plants')
        .select(select).eq('zone_level', 'l4').eq('zone_code', zoneCode);
      rows = (data ?? []) as unknown as ZonePlant[];
    }
    if (!rows.length && apiary.ecoregion_l3) {
      zoneLevel = 'l3';
      zoneCode = apiary.ecoregion_l3;
      const { data } = await auth.supabase.from('zone_plants')
        .select(select).eq('zone_level', 'l3').eq('zone_code', zoneCode);
      rows = (data ?? []) as unknown as ZonePlant[];
    }
    if (!rows.length) {
      res.status(200).json({ available: false, reason: 'zone-not-curated', zoneLevel, zoneCode, plants: [] });
      return;
    }

    // Temperatures for the season-offset calculation.
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDate = `${today.getUTCFullYear() - 3}-01-01`;
    const archiveEnd = new Date(today.getTime() - 3 * DAY_MS).toISOString().slice(0, 10);
    const base = `latitude=${apiary.latitude}&longitude=${apiary.longitude}&temperature_unit=fahrenheit&timezone=auto&daily=temperature_2m_max,temperature_2m_min`;

    const [arch, recent] = await Promise.all([
      fetchFirstOk([`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${archiveEnd}`], 10_000),
      fetchFirstOk([`https://api.open-meteo.com/v1/forecast?${base}&start_date=${archiveEnd}&end_date=${endDate}`], 6_000),
    ]);

    const days: { date: string; tmax: number; tmin: number }[] = [];
    for (const r of [arch, recent]) {
      if (!r) continue;
      const j: any = await r.res.json();
      const t = j?.daily;
      if (!t?.time) continue;
      for (let i = 0; i < t.time.length; i++) {
        const tmax = t.temperature_2m_max[i], tmin = t.temperature_2m_min[i];
        if (tmax == null || tmin == null) continue;
        days.push({ date: t.time[i], tmax, tmin });
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const season = seasonOffsetDays(days, today);
    const todayDoy = dayOfYearUTC(today);

    const plants = rows.map(r => {
      const s = r.bloom_start ? mmddToDoy(r.bloom_start) : null;
      const p = r.bloom_peak ? mmddToDoy(r.bloom_peak) : null;
      const e = r.bloom_end ? mmddToDoy(r.bloom_end) : null;
      if (s == null || p == null || e == null) return null;
      // An early season pulls bloom earlier, so a positive offset shifts windows down.
      const shift = -season.offset;
      const status = statusFor(s + shift, p + shift, e + shift, todayDoy);
      return {
        name: r.plants?.common_name ?? 'Unknown',
        scientificName: r.plants?.scientific_name ?? null,
        photoUrl: r.plants?.photo_url ?? null,
        status,
        nectarValue: r.nectar_value,
        confidence: r.confidence,
        source: r.source,
        daysUntil: status === 'upcoming' ? (s + shift) - todayDoy : null,
      };
    }).filter(Boolean);

    // Blooming now first, then by nectar value: what might make honey leads.
    const order: Record<BloomStatus, number> = { peak: 0, starting: 1, ending: 2, upcoming: 3, over: 4 };
    plants.sort((a: any, b: any) =>
      order[a.status as BloomStatus] - order[b.status as BloomStatus] ||
      (b.nectarValue ?? 0) - (a.nectarValue ?? 0));

    res.setHeader('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    res.status(200).json({
      available: true,
      zoneLevel,
      zoneCode,
      approximateLocation: apiary.ecoregion_source === 'zip',
      season: {
        offsetDays: season.offset,          // positive = running early
        gddToDate: season.gddToDate,
        comparedYears: season.comparedYears,
      },
      plants,
    });
  } catch (e: any) {
    console.error('Bloom endpoint error:', e);
    res.status(500).json({ error: 'Failed to load bloom data: ' + (e.message ?? 'Unknown error') });
  }
}
