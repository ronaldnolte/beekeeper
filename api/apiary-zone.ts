import { applyCors, getAuthedUser, getBearerToken, createRateLimiter, getClientIp } from './_lib.js';
import { initEarthEngine } from './bands-fetcher.js';
import { resolveEcoregion } from './ecoregion.js';

// Resolves an apiary to its EPA ecoregion and caches the result on the row.
//
// The lookup costs an Earth Engine round-trip (measured 240-735 ms) plus EE
// authentication, which is far too much to pay on every bloom-panel load for a value
// that never changes. So it is resolved once, lazily, and stored.
//
// `ecoregion_resolved_at` distinguishes the two null cases: null codes with a null
// timestamp means "never looked up"; null codes WITH a timestamp means "looked up and
// found to be outside the conterminous US", which must fall back to the national plant
// list rather than being retried forever.
//
// Apiaries with no coordinates cannot be placed in a zone at all. Rather than guessing
// from a zip code, those return needsCoordinates so the UI can point the beekeeper at the
// map picker - the nectar index needs real coordinates too, so the prompt pays twice.

// Each call may hit Earth Engine, so cap how fast one client can force fresh lookups.
// Generous: a beekeeper with a handful of apiaries resolves each of them exactly once.
const zoneLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

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

  try {
    // RLS scopes this to apiaries the caller owns, so no ownership check is needed here:
    // someone else's id simply returns no row.
    const { data: apiary, error } = await auth.supabase
      .from('apiaries')
      .select('id, latitude, longitude, ecoregion_l3, ecoregion_l4, ecoregion_resolved_at')
      .eq('id', apiaryId)
      .single();

    if (error || !apiary) {
      res.status(404).json({ error: 'Apiary not found' });
      return;
    }

    if (apiary.ecoregion_resolved_at) {
      res.status(200).json({
        l3code: apiary.ecoregion_l3,
        l4code: apiary.ecoregion_l4,
        cached: true,
        needsCoordinates: false,
      });
      return;
    }

    if (apiary.latitude == null || apiary.longitude == null) {
      res.status(200).json({
        l3code: null,
        l4code: null,
        cached: false,
        needsCoordinates: true,
      });
      return;
    }

    await initEarthEngine();
    const zone = await resolveEcoregion(apiary.latitude, apiary.longitude);

    // Written even when the codes are null: that records "we looked, it is outside
    // coverage" so the lookup is not repeated on every load.
    const { error: updateError } = await auth.supabase
      .from('apiaries')
      .update({
        ecoregion_l3: zone.l3code,
        ecoregion_l4: zone.l4code,
        ecoregion_resolved_at: new Date().toISOString(),
      })
      .eq('id', apiaryId);

    if (updateError) {
      // The lookup still succeeded, so return it rather than failing the request -
      // the next call will simply resolve again.
      console.error('Failed to cache ecoregion:', updateError);
    }

    res.status(200).json({
      l3code: zone.l3code,
      l3name: zone.l3name,
      l4code: zone.l4code,
      l4name: zone.l4name,
      cached: false,
      needsCoordinates: false,
    });
  } catch (e: any) {
    console.error('Ecoregion resolve error:', e);
    res.status(500).json({ error: 'Failed to resolve ecoregion: ' + (e.message ?? 'Unknown error') });
  }
}
