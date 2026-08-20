// Resolves a coordinate to its EPA (Omernik) Level III and Level IV ecoregion.
//
// Why ecoregions rather than USDA hardiness zones: hardiness zones encode average annual
// winter minimum temperature — what survives the cold — not what grows somewhere or when
// it blooms. Albuquerque and middle Tennessee are both 7a. Omernik ecoregions are built
// from vegetation, landform, soils, hydrology, climate and land use, so they separate
// places that actually differ floristically. Ron's two New Mexico apiaries sit 30 km apart
// and fall in different LEVEL III regions: South Valley in 22g Rio Grande Floodplain,
// Tijeras in 23e Conifer Woodlands and Savannas.
//
// Level III (105 regions) is the coarse key and Level IV (967) the fine one. Plant lists
// resolve L4 -> L3 -> national fallback, so an apiary in an uncurated Level IV still gets
// its Level III list and a brand-new area still gets something sensible.
//
// Coverage is the conterminous United States only. Alaska, Hawaii and anywhere
// international resolve to null and must fall through to the national list.
// @ts-ignore
import ee from '@google/earthengine';

export interface Ecoregion {
  l3code: string | null;
  l3name: string | null;
  l4code: string | null;
  l4name: string | null;
}

export const UNKNOWN_ECOREGION: Ecoregion = { l3code: null, l3name: null, l4code: null, l4name: null };

/**
 * Look up the ecoregion for a coordinate. Assumes Earth Engine is already initialised
 * (the nectar endpoint does this); callers outside that path must initialise first.
 */
export async function resolveEcoregion(lat: number, lng: number): Promise<Ecoregion> {
  const point = ee.Geometry.Point([lng, lat]);
  const hit = ee.FeatureCollection('EPA/Ecoregions/2013/L4').filterBounds(point).first();

  const props: any = await new Promise((resolve, reject) => {
    hit.evaluate((result: any, error: any) => (error ? reject(new Error(error)) : resolve(result)));
  });

  const p = props?.properties;
  if (!p) return UNKNOWN_ECOREGION;
  return {
    l3code: p.us_l3code ?? null,
    l3name: p.us_l3name ?? null,
    l4code: p.us_l4code ?? null,
    l4name: p.us_l4name ?? null,
  };
}
