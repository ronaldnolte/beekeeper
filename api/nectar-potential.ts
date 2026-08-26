import { applyCors, getAuthedUser, getBearerToken } from './_lib.js';
import { fetchCompleteWeather, historyStartDate } from './_shared/weather.js';
import { computeBloomBase, type PlantWindow } from './_shared/bloom-engine.js';
import { withNormals } from './_shared/normal.js';
import { resolveEcoregion } from './_shared/ecoregion.js';
import { initEarthEngine } from './_shared/bands-fetcher.js';

// Nectar Potential: what the apiary's own plant list says should be yielding today,
// against the same date in the previous five years.
//
// This is the bloom half of the plant-driven design, on its own and unmodified. No
// satellite reading touches it — that is deliberate for review, so the calendar's
// contribution can be judged before anything is layered on top of it. It is therefore NOT
// the nectar index and must not be presented as one: it says what should be open and how
// good those plants are, not whether they are actually running.
//
// Cost: a weather call and some arithmetic, about a second, against roughly eighteen for
// the satellite index. The one exception is an apiary whose ecoregion has never been looked
// up — that first request touches Earth Engine, then caches the answer on the row and never
// does it again.

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await getAuthedUser(getBearerToken(req));
  if (!auth) { res.status(401).json({ error: 'You must be signed in.' }); return; }

  const apiaryId = req.method === 'POST' ? req.body?.apiaryId : req.query?.apiaryId;
  if (!apiaryId || typeof apiaryId !== 'string') {
    res.status(400).json({ error: 'apiaryId is required' });
    return;
  }

  try {
    const { data: apiary, error } = await auth.supabase
      .from('apiaries')
      .select('id, name, latitude, longitude, ecoregion_l3, ecoregion_l4, ecoregion_resolved_at')
      .eq('id', apiaryId)
      .single();

    if (error || !apiary) { res.status(404).json({ error: 'Apiary not found' }); return; }
    if (apiary.latitude == null || apiary.longitude == null) {
      res.status(200).json({ available: false, reason: 'no-coordinates', history: [] });
      return;
    }

    const lat = Number(apiary.latitude);
    const lng = Number(apiary.longitude);

    // Resolve the ecoregion on demand rather than sending the caller away to another
    // endpoint first. Happens once per apiary, then it is cached on the row.
    //
    // initEarthEngine FIRST. resolveEcoregion documents that it assumes an initialised
    // client, and on an uninitialised one the Earth Engine library falls back to a
    // synchronous request -- which the xmlhttprequest package services by writing a temp
    // file into the working directory. That is read-only on Vercel, so it surfaced as
    // "EROFS: read-only file system, open '.node-xmlhttprequest-sync-4'" rather than as
    // anything resembling a missing initialisation.
    let l3 = apiary.ecoregion_l3;
    let l4 = apiary.ecoregion_l4;
    if (!apiary.ecoregion_resolved_at) {
      await initEarthEngine();
      const zone = await resolveEcoregion(lat, lng);
      l3 = zone.l3code;
      l4 = zone.l4code;
      await auth.supabase.from('apiaries').update({
        ecoregion_l3: zone.l3code,
        ecoregion_l4: zone.l4code,
        ecoregion_resolved_at: new Date().toISOString(),
        ecoregion_source: 'coordinates',
      }).eq('id', apiaryId);
    }

    if (!l3 && !l4) {
      // Outside the contiguous 48. The ecoregion dataset does not cover Alaska, Hawaii or
      // anywhere overseas, so there is no plant list to be had.
      res.status(200).json({
        available: false,
        reason: 'outside-coverage',
        message: 'Option not available outside of contiguous 48 states.',
        history: [],
      });
      return;
    }

    // Level IV first, then Level III, so an uncurated fine zone still gets a list.
    const select = 'plant_id, bloom_start, bloom_peak, bloom_end, nectar_value, source, confidence, plants(common_name)';
    let zoneLevel = 'l4';
    let zoneCode = l4;
    let rows: any[] = [];

    if (zoneCode) {
      const { data } = await auth.supabase.from('zone_plants')
        .select(select).eq('zone_level', 'l4').eq('zone_code', zoneCode);
      rows = data ?? [];
    }
    if (!rows.length && l3) {
      zoneLevel = 'l3';
      zoneCode = l3;
      const { data } = await auth.supabase.from('zone_plants')
        .select(select).eq('zone_level', 'l3').eq('zone_code', zoneCode);
      rows = data ?? [];
    }
    if (!rows.length) {
      res.status(200).json({
        available: false, reason: 'zone-not-curated', zoneLevel, zoneCode, history: [],
      });
      return;
    }

    // No gap filling. A row without a bloom window or without a nectar rating is not
    // usable, and substituting a middling default would invent forage that nobody
    // researched. Unusable rows are counted and reported instead.
    const usable = rows.filter(r =>
      r.bloom_start && r.bloom_peak && r.bloom_end && r.nectar_value != null);
    const unusable = rows.length - usable.length;

    // Thresholds already derived for THIS apiary. Prior years' accumulated warmth never
    // changes, so they are read rather than recomputed on every request.
    const { data: storedRows } = await auth.supabase
      .from('apiary_plant_thresholds')
      .select('plant_id, trigger_type, threshold_start, threshold_peak, threshold_end')
      .eq('apiary_id', apiaryId);
    const stored = new Map<string, any>((storedRows ?? []).map((t: any) => [t.plant_id, t]));

    const plants: PlantWindow[] = usable.map(r => {
      const t = stored.get(r.plant_id);
      return {
        name: r.plants?.common_name ?? 'Unknown',
        bloomStart: r.bloom_start,
        bloomPeak: r.bloom_peak,
        bloomEnd: r.bloom_end,
        nectarValue: r.nectar_value,
        storedThreshold: t
          ? { start: Number(t.threshold_start), peak: Number(t.threshold_peak), end: Number(t.threshold_end) }
          : undefined,
      };
    });

    if (!plants.length) {
      res.status(200).json({
        available: false, reason: 'no-usable-windows', zoneLevel, zoneCode, history: [],
      });
      return;
    }

    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDate = historyStartDate(today);

    // Must be a COMPLETE series. Open-Meteo's archive has no holes, so a short response
    // means the request failed -- and an index built on a partial series is garbage that
    // looks fine. Retries once, emails on a second failure, then gives up.
    const weather = await fetchCompleteWeather(
      lat, lng, startDate, endDate,
      `Nectar Potential for apiary ${apiaryId} (${apiary.name})`
    );
    if (!weather) {
      res.status(200).json({ available: false, reason: 'weather-incomplete', history: [] });
      return;
    }
    const temps = Object.entries(weather.days)
      .map(([date, d]) => ({ date, tmax: d.tmax, tmin: d.tmin }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bloom = computeBloomBase(plants, temps);
    const normals = withNormals(bloom.dates, bloom.potential);

    // Save any threshold derived on this request. A prior year's accumulated warmth on a
    // given date is fixed forever, so this is a one-time cost per apiary and plant. Failure
    // to save is not fatal -- the numbers are already computed and correct for this
    // response; the next request simply derives them again.
    const priorYearCount = new Set(
      temps.map(t => t.date.slice(0, 4)).filter(y => y < String(new Date().getUTCFullYear()))
    ).size;
    const toSave = bloom.thresholds
      .map(t => {
        const row = usable.find(r => (r.plants?.common_name ?? 'Unknown') === t.name);
        if (!row || stored.has(row.plant_id)) return null;
        return {
          apiary_id: apiaryId,
          plant_id: row.plant_id,
          trigger_type: t.trigger,
          threshold_start: t.start,
          threshold_peak: t.peak,
          threshold_end: t.end,
          weather_years: priorYearCount,
          zone_level: zoneLevel,
          zone_code: zoneCode,
          computed_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (toSave.length) {
      const { error: saveError } = await auth.supabase
        .from('apiary_plant_thresholds')
        .upsert(toSave, { onConflict: 'apiary_id,plant_id' });
      if (saveError) console.error('Could not save bloom thresholds:', saveError.message);
    }

    const history = bloom.dates.map((date, i) => ({
      date,
      potential: Math.round(bloom.potential[i] * 1000) / 1000,
      normal: normals[i].normal,
      deviation: normals[i].deviation,
      spread: normals[i].spread,
      normalYears: normals[i].normalYears,
    }));

    const last = history[history.length - 1];

    res.setHeader('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    res.status(200).json({
      available: true,
      apiary: { id: apiary.id, name: apiary.name, lat, lng },
      zoneLevel,
      zoneCode,
      plantCount: plants.length,
      // Rows in the zone list we could not use: missing a bloom window or a nectar rating.
      unusablePlants: unusable,
      // Days this year the list cannot account for at all. A hole in the research, not a
      // dearth, and it has to be visible rather than reported to a beekeeper as zero forage.
      emptyDays: bloom.emptyDays,
      latest: {
        date: last?.date ?? null,
        potential: last?.potential ?? null,
        normal: last?.normal ?? null,
        deviation: last?.deviation ?? null,
        breakdown: bloom.latestBreakdown.map(b => ({
          name: b.name,
          openness: Math.round(b.openness * 100) / 100,
          nectarValue: b.nectarValue,
          contribution: Math.round(b.contribution * 1000) / 1000,
          trigger: b.trigger,
        })),
      },
      thresholds: bloom.thresholds.map(t => ({
        name: t.name,
        trigger: t.trigger,
        start: Math.round(t.start),
        peak: Math.round(t.peak),
        end: Math.round(t.end),
      })),
      weather: { archive_ok: weather.archive_ok, forecast_source: weather.forecast_source },
      history,
    });
  } catch (e: any) {
    console.error('Nectar potential error:', e);
    res.status(500).json({ error: 'Failed to compute nectar potential: ' + (e?.message ?? 'Unknown error') });
  }
}
