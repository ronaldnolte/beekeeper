import { applyCors, getAuthedUser, createRateLimiter } from './_lib.js';
import { buildApiaryBloom, inBloomCoverage, withPlantInfo } from './_bloom/build.js';

// An apiary's bloom table (bloom plan step 3, E:\claude\bloom-integration\PLAN.md).
//
// POST { apiaryId, sessionToken, rebuild? }. Returns the apiary's stored apiary_bloom row, building it
// first when there is none or the apiary has moved since it was built. Building asks GBIF which plants
// are nearby and Daymet for the spot's normal heat — about 14 requests, a few seconds, once per
// location. Everything reads and writes through the signed-in user's own client, so the database's
// owner-only rules apply exactly as they do in the app.
//
// Answers always say which case applies, so the app can show the right thing and Nectar is never
// held up by bloom:
//   { status: 'ok', bloom }         the table (bloom.plants holds master-list IDs + month-day dates)
//   { status: 'no_location' }       the apiary has no map coordinates yet
//   { status: 'outside' }           outside North America: the section is hidden
//   503 { status: 'unavailable' }   GBIF or Daymet did not answer; try again later

// Each build costs ~14 outside requests; a beekeeper needs one per apiary per move.
const buildLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

// Requests to GBIF / Daymet, retried a few times: both have the occasional slow or failed answer.
async function getJson(url: string, tries = 3): Promise<any> {
  for (let t = 1; ; t++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
      if (res.ok) return await res.json();
      if (t >= tries || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} from ${url.split('?')[0]}`);
    } catch (e) {
      if (t >= tries) throw e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 1000 * t));
  }
}

// Coordinates are compared with a little slack so re-saving an apiary without moving it keeps its table.
const samePlace = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// The app gets each plant's name details and nectar/pollen kind from the master list here, so it never has to
// download the whole list. The stored row keeps only IDs and dates.
const forApp = (row: any) => ({ ...row, plants: withPlantInfo(row.plants ?? []) });

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { apiaryId, sessionToken, rebuild } = req.body ?? {};
  if (!apiaryId) {
    res.status(400).json({ error: 'apiaryId is required' });
    return;
  }

  const auth = await getAuthedUser(sessionToken);
  if (!auth) {
    res.status(401).json({ error: 'You must be signed in.' });
    return;
  }
  const { user, supabase } = auth;

  // The user's own client only sees their own apiaries, so someone else's apiary reads as not found.
  const { data: apiary, error: apiaryError } = await supabase
    .from('apiaries')
    .select('id, latitude, longitude')
    .eq('id', apiaryId)
    .maybeSingle();
  if (apiaryError) {
    console.error('apiary-bloom: apiary read failed', apiaryError);
    res.status(500).json({ error: 'Could not read the apiary.' });
    return;
  }
  if (!apiary) {
    res.status(404).json({ error: 'Apiary not found.' });
    return;
  }

  const lat = apiary.latitude == null ? NaN : Number(apiary.latitude);
  const lon = apiary.longitude == null ? NaN : Number(apiary.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(200).json({ status: 'no_location' });
    return;
  }
  if (!inBloomCoverage(lat, lon)) {
    res.status(200).json({ status: 'outside' });
    return;
  }

  const { data: stored } = await supabase.from('apiary_bloom').select('*').eq('apiary_id', apiaryId).maybeSingle();
  if (stored && !rebuild && samePlace(stored.built_lat, lat) && samePlace(stored.built_lon, lon)) {
    res.status(200).json({ status: 'ok', bloom: forApp(stored) });
    return;
  }

  if (buildLimiter(user.id)) {
    // Too many builds in a short time: hand back what there is rather than an error.
    if (stored) res.status(200).json({ status: 'ok', bloom: forApp(stored), stale: true });
    else res.status(429).json({ status: 'unavailable', error: 'Too many bloom requests; try again in a few minutes.' });
    return;
  }

  let built;
  const t0 = Date.now();
  try {
    built = await buildApiaryBloom(lat, lon, getJson);
  } catch (e: any) {
    console.error('apiary-bloom: build failed', e?.message ?? e);
    res.status(503).json({ status: 'unavailable', error: 'Bloom list not available right now. Try again later.' });
    return;
  }

  const row = { apiary_id: apiaryId, user_id: user.id, ...built, built_at: new Date().toISOString() };
  const { data: saved, error: saveError } = await supabase.from('apiary_bloom').upsert(row).select().single();
  if (saveError) {
    // The table is still good for this answer; it will simply be built again next time.
    console.error('apiary-bloom: save failed', saveError);
  }
  res.status(200).json({ status: 'ok', bloom: forApp(saved ?? row), build_ms: Date.now() - t0 });
}
