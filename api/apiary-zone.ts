import { applyCors, getAuthedUser, getBearerToken, createRateLimiter, getClientIp } from './_lib.js';
import { initEarthEngine, describePointLandCover } from './_shared/bands-fetcher.js';
import { resolveEcoregion } from './_shared/ecoregion.js';

// Resolves an apiary to its EPA ecoregion, caches the result on the row, and sanity-checks
// the pin while it is there.
//
// Caching: the lookup costs an Earth Engine round-trip (240-735 ms) plus EE authentication,
// far too much to pay on every bloom-panel load for a value that never changes. The panel
// itself needs only Open-Meteo and should stay fast.
//
// Coordinate source: an apiary holding only a zip code still gets a zone. The client
// already geocodes the zip for the nectar index, so refusing here would make bloom stricter
// than a feature that already works. But a zip centroid is coarse — the two New Mexico test
// apiaries sit 30 km apart in DIFFERENT Level III ecoregions, so a zip spanning valley and
// foothills can land on the wrong side. Zones derived that way are marked approximate, and
// re-resolved once real coordinates appear.
//
// Pin check: a pin on bare ground, pavement or open water is almost certainly a typo, and it
// silently wrecks the index because those land covers carry a forage weight of zero. A
// one-mile slip is enough to put an apiary in a gravel pit.

const zoneLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

/**
 * Land covers where a pin is very likely a typo. Deliberately EXCLUDES built-up (50):
 * checked against the 13 real apiaries in the database, three of them sit on pixels
 * classified built-up — backyard and suburban hives are completely normal, and
 * WorldCover labels residential lots as built-up at 10 m. Warning on that would have
 * fired on nearly a quarter of real users. Bare ground still catches the gravel-pit
 * case; water, snow, mangrove and moss are simply not places hives sit.
 */
const IMPLAUSIBLE_FOR_HIVES = new Set([60, 70, 80, 95, 100]);

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await getAuthedUser(getBearerToken(req));
  if (!auth) {
    res.status(401).json({ error: 'You must be signed in.' });
    return;
  }
  if (zoneLimiter(getClientIp(req))) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    return;
  }

  const apiaryId = req.body?.apiaryId;
  if (!apiaryId || typeof apiaryId !== 'string') {
    res.status(400).json({ error: 'apiaryId is required' });
    return;
  }
  // Only consulted when the row itself has no coordinates: the client has already
  // geocoded the zip for the nectar index and passes the result through.
  const fallbackLat = Number(req.body?.lat);
  const fallbackLng = Number(req.body?.lng);
  const hasFallback = Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng);

  try {
    // RLS scopes this to apiaries the caller owns, so another user's id simply
    // returns no row and no explicit ownership check is needed.
    const { data: apiary, error } = await auth.supabase
      .from('apiaries')
      .select('id, latitude, longitude, ecoregion_l3, ecoregion_l4, ecoregion_resolved_at, ecoregion_source')
      .eq('id', apiaryId)
      .single();

    if (error || !apiary) {
      res.status(404).json({ error: 'Apiary not found' });
      return;
    }

    const hasRealCoords = apiary.latitude != null && apiary.longitude != null;

    // Re-resolve an approximate zone once real coordinates arrive; otherwise trust the cache.
    const cacheIsStale = apiary.ecoregion_source === 'zip' && hasRealCoords;
    if (apiary.ecoregion_resolved_at && !cacheIsStale) {
      res.status(200).json({
        l3code: apiary.ecoregion_l3,
        l4code: apiary.ecoregion_l4,
        source: apiary.ecoregion_source,
        approximate: apiary.ecoregion_source === 'zip',
        cached: true,
      });
      return;
    }

    const lat = hasRealCoords ? apiary.latitude : hasFallback ? fallbackLat : null;
    const lng = hasRealCoords ? apiary.longitude : hasFallback ? fallbackLng : null;
    const source = hasRealCoords ? 'coordinates' : hasFallback ? 'zip' : null;

    if (lat == null || lng == null) {
      // No coordinates and no geocoded fallback: the caller falls back to the
      // national plant list.
      res.status(200).json({
        l3code: null, l4code: null, source: null,
        approximate: false, cached: false, needsLocation: true,
      });
      return;
    }

    await initEarthEngine();
    const [zone, cover] = await Promise.all([
      resolveEcoregion(lat, lng),
      describePointLandCover(lat, lng),
    ]);

    // Only a zone derived from real coordinates is worth caching as authoritative;
    // a zip-derived one is cached too, but flagged so it can be upgraded later.
    const { error: updateError } = await auth.supabase
      .from('apiaries')
      .update({
        ecoregion_l3: zone.l3code,
        ecoregion_l4: zone.l4code,
        ecoregion_source: source,
        ecoregion_resolved_at: new Date().toISOString(),
      })
      .eq('id', apiaryId);

    if (updateError) {
      // The lookup succeeded, so return it rather than failing — the next call
      // simply resolves again.
      console.error('Failed to cache ecoregion:', updateError);
    }

    const implausible = cover.code != null && IMPLAUSIBLE_FOR_HIVES.has(cover.code);

    res.status(200).json({
      l3code: zone.l3code,
      l3name: zone.l3name,
      l4code: zone.l4code,
      l4name: zone.l4name,
      source,
      approximate: source === 'zip',
      cached: false,
      needsLocation: false,
      landCover: cover.name,
      // A warning, never a block: someone genuinely may keep hives on a rooftop.
      locationWarning: implausible
        ? `This location sits on ${cover.name}, which produces no forage. If that is not right, check the pin — a small typo can move an apiary onto bare ground and quietly distort the index.`
        : null,
    });
  } catch (e: any) {
    console.error('Ecoregion resolve error:', e);
    res.status(500).json({ error: 'Failed to resolve ecoregion: ' + (e.message ?? 'Unknown error') });
  }
}
