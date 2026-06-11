import type { PlantProfileEntry } from './bloomFactor';

export interface RegionalProfile {
  name: string;
  baseZone: number;
  plants: PlantProfileEntry[];
}

const PROFILES: Record<string, RegionalProfile> = {
  florida: {
    name: 'Florida Subtropical',
    baseZone: 10,
    plants: [
      { name: 'Citrus / Orange Blossom', bloom_start: '01-15', bloom_peak: '03-01', bloom_end: '04-15' },
      { name: 'Gallberry / Inkberry',    bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-01' },
      { name: 'Tallow Tree',             bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-01' },
      { name: 'Spanish Needles (Bidens)',bloom_start: '03-01', bloom_peak: '05-01', bloom_end: '11-30' },
      { name: 'Saw Palmetto',            bloom_start: '06-01', bloom_peak: '07-01', bloom_end: '08-15' },
      { name: 'Brazilian Pepper',        bloom_start: '09-01', bloom_peak: '10-15', bloom_end: '11-30' },
    ],
  },

  southTexas: {
    name: 'South Texas / Gulf Brush',
    baseZone: 9,
    plants: [
      { name: 'Huisache (Sweet Acacia)', bloom_start: '01-15', bloom_peak: '02-15', bloom_end: '03-15' },
      { name: 'Bluebonnet',              bloom_start: '02-15', bloom_peak: '03-15', bloom_end: '04-15' },
      { name: 'Huajillo',                bloom_start: '02-15', bloom_peak: '03-15', bloom_end: '04-30' },
      { name: 'Catclaw Acacia',          bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'Cenizo (Texas Sage)',     bloom_start: '07-01', bloom_peak: '08-15', bloom_end: '10-01' },
      { name: 'Goldenrod & Aster',       bloom_start: '09-01', bloom_peak: '10-01', bloom_end: '11-15' },
    ],
  },

  southwestArid: {
    name: 'Southwest Arid Desert',
    baseZone: 8,
    plants: [
      { name: 'Palo Verde',              bloom_start: '04-01', bloom_peak: '04-20', bloom_end: '05-15' },
      { name: 'Saguaro Cactus',          bloom_start: '04-15', bloom_peak: '05-10', bloom_end: '06-01' },
      { name: 'Mesquite',                bloom_start: '04-15', bloom_peak: '05-15', bloom_end: '06-15' },
      { name: 'Catclaw Acacia',          bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'Desert Willow',           bloom_start: '05-15', bloom_peak: '06-15', bloom_end: '08-01' },
      { name: 'Desert Marigold',         bloom_start: '04-01', bloom_peak: '06-01', bloom_end: '10-31' },
      { name: 'Chamisa / Rabbitbrush',   bloom_start: '08-15', bloom_peak: '09-15', bloom_end: '10-31' },
    ],
  },

  california: {
    name: 'California',
    baseZone: 9,
    plants: [
      { name: 'Manzanita',               bloom_start: '01-15', bloom_peak: '02-15', bloom_end: '03-31' },
      { name: 'Wild Mustard',            bloom_start: '01-01', bloom_peak: '02-15', bloom_end: '04-01' },
      { name: 'Fruit Trees (almond, cherry, apple)', bloom_start: '02-01', bloom_peak: '03-01', bloom_end: '04-01' },
      { name: 'Sage (black & white)',    bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'Blue Elderberry',         bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'Yellow Star Thistle',     bloom_start: '05-15', bloom_peak: '07-01', bloom_end: '09-15' },
    ],
  },

  pacificNorthwest: {
    name: 'Pacific Northwest',
    baseZone: 8,
    plants: [
      { name: 'Bigleaf Maple & Red Alder', bloom_start: '02-15', bloom_peak: '03-20', bloom_end: '04-10' },
      { name: 'Oregon Grape',            bloom_start: '03-01', bloom_peak: '04-01', bloom_end: '05-01' },
      { name: 'Fruit Trees (cherry, apple, pear)', bloom_start: '03-15', bloom_peak: '04-15', bloom_end: '05-15' },
      { name: 'Himalayan Blackberry',    bloom_start: '05-15', bloom_peak: '06-15', bloom_end: '07-20' },
      { name: 'Fireweed',               bloom_start: '06-15', bloom_peak: '07-15', bloom_end: '08-31' },
      { name: 'Goldenrod',               bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-15' },
    ],
  },

  mountainWest: {
    name: 'Mountain West',
    baseZone: 5,
    plants: [
      { name: 'Willow',                  bloom_start: '04-01', bloom_peak: '04-20', bloom_end: '05-15' },
      { name: 'Serviceberry / Saskatoon',bloom_start: '04-15', bloom_peak: '05-01', bloom_end: '05-25' },
      { name: 'Wild Raspberry',          bloom_start: '06-01', bloom_peak: '06-20', bloom_end: '07-15' },
      { name: 'White Clover & Vetch',    bloom_start: '06-01', bloom_peak: '07-01', bloom_end: '08-15' },
      { name: 'Goldenrod',               bloom_start: '07-15', bloom_peak: '08-15', bloom_end: '09-30' },
      { name: 'Rabbitbrush / Chamisa',   bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-01' },
    ],
  },

  greatPlains: {
    name: 'Great Plains',
    baseZone: 5,
    plants: [
      { name: 'Dandelion',               bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-01' },
      { name: 'Sweet Clover (white & yellow)', bloom_start: '05-15', bloom_peak: '07-01', bloom_end: '08-15' },
      { name: 'Alfalfa',                 bloom_start: '05-15', bloom_peak: '07-01', bloom_end: '09-01' },
      { name: 'Plains Wildflowers',      bloom_start: '05-01', bloom_peak: '05-20', bloom_end: '06-15' },
      { name: 'Sunflower',               bloom_start: '07-01', bloom_peak: '08-01', bloom_end: '09-15' },
      { name: 'Goldenrod',               bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-15' },
    ],
  },

  southeast: {
    name: 'Southeast',
    baseZone: 7,
    plants: [
      { name: 'Red Maple',               bloom_start: '02-01', bloom_peak: '03-01', bloom_end: '03-20' },
      { name: 'Redbud',                  bloom_start: '03-01', bloom_peak: '03-20', bloom_end: '04-15' },
      { name: 'Fruit Trees (peach, plum, apple)', bloom_start: '03-01', bloom_peak: '04-01', bloom_end: '04-20' },
      { name: 'Tulip Poplar',            bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-01' },
      { name: 'White Clover',            bloom_start: '04-15', bloom_peak: '05-31', bloom_end: '08-15' },
      { name: 'Sourwood',                bloom_start: '06-15', bloom_peak: '07-15', bloom_end: '08-15' },
      { name: 'Goldenrod',               bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-31' },
      { name: 'Aster',                   bloom_start: '09-01', bloom_peak: '10-01', bloom_end: '11-01' },
    ],
  },

  northeast: {
    name: 'Northeast',
    baseZone: 6,
    plants: [
      { name: 'Red Maple',               bloom_start: '03-15', bloom_peak: '04-01', bloom_end: '04-20' },
      { name: 'Fruit Trees (apple, cherry, pear)', bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '05-20' },
      { name: 'Dandelion',               bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'White Clover',            bloom_start: '05-15', bloom_peak: '06-30', bloom_end: '09-01' },
      { name: 'Basswood / American Linden', bloom_start: '06-20', bloom_peak: '07-10', bloom_end: '07-25' },
      { name: 'Goldenrod',               bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-15' },
      { name: 'Aster',                   bloom_start: '08-15', bloom_peak: '09-15', bloom_end: '10-31' },
    ],
  },

  midwest: {
    name: 'Midwest',
    baseZone: 6,
    plants: [
      { name: 'Silver Maple',            bloom_start: '03-15', bloom_peak: '04-05', bloom_end: '04-20' },
      { name: 'Dandelion',               bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-15' },
      { name: 'Fruit Trees (apple, cherry)', bloom_start: '04-10', bloom_peak: '05-01', bloom_end: '05-20' },
      { name: 'White Clover',            bloom_start: '05-15', bloom_peak: '07-01', bloom_end: '09-01' },
      { name: 'Basswood / American Linden', bloom_start: '06-15', bloom_peak: '07-05', bloom_end: '07-20' },
      { name: 'Goldenrod',               bloom_start: '08-01', bloom_peak: '09-01', bloom_end: '10-15' },
      { name: 'Aster',                   bloom_start: '08-15', bloom_peak: '09-15', bloom_end: '10-31' },
    ],
  },

  northernEurope: {
    name: 'Northern Europe',
    baseZone: 8,
    plants: [
      { name: 'Willow (Salix)',               bloom_start: '02-15', bloom_peak: '03-10', bloom_end: '04-01' },
      { name: 'Fruit Trees',                  bloom_start: '04-01', bloom_peak: '04-20', bloom_end: '05-10' },
      { name: 'Oilseed Rape / Canola',        bloom_start: '04-15', bloom_peak: '05-05', bloom_end: '06-01' },
      { name: 'Phacelia',                     bloom_start: '05-15', bloom_peak: '06-10', bloom_end: '07-01' },
      { name: 'White Clover',                 bloom_start: '06-01', bloom_peak: '07-01', bloom_end: '08-31' },
      { name: 'Linden / Lime Tree (Tilia)',   bloom_start: '06-20', bloom_peak: '07-07', bloom_end: '07-25' },
      { name: 'Heather (Calluna vulgaris)',   bloom_start: '08-01', bloom_peak: '08-20', bloom_end: '09-20' },
      { name: 'Ivy (Hedera)',                 bloom_start: '09-15', bloom_peak: '10-01', bloom_end: '10-31' },
    ],
  },

  centralEurope: {
    name: 'Central Europe',
    baseZone: 6,
    plants: [
      { name: 'Willow / Sallow',              bloom_start: '03-01', bloom_peak: '03-20', bloom_end: '04-15' },
      { name: 'Fruit Trees (apple, cherry, plum)', bloom_start: '03-20', bloom_peak: '04-10', bloom_end: '05-01' },
      { name: 'Oilseed Rape / Canola',        bloom_start: '04-15', bloom_peak: '05-10', bloom_end: '06-01' },
      { name: 'Black Locust / Acacia',        bloom_start: '05-01', bloom_peak: '05-25', bloom_end: '06-15' },
      { name: 'White Clover',                 bloom_start: '06-01', bloom_peak: '07-01', bloom_end: '08-31' },
      { name: 'Linden (Tilia)',               bloom_start: '06-20', bloom_peak: '07-07', bloom_end: '07-25' },
      { name: 'Sunflower',                    bloom_start: '07-01', bloom_peak: '08-01', bloom_end: '09-01' },
      { name: 'Goldenrod & Aster',            bloom_start: '08-15', bloom_peak: '09-10', bloom_end: '10-01' },
    ],
  },

  mediterranean: {
    name: 'Mediterranean Europe',
    baseZone: 9,
    plants: [
      { name: 'Rosemary & Winter Heather',    bloom_start: '01-01', bloom_peak: '02-15', bloom_end: '04-01' },
      { name: 'Citrus Blossom',               bloom_start: '02-15', bloom_peak: '03-20', bloom_end: '04-15' },
      { name: 'Fruit Trees',                  bloom_start: '02-01', bloom_peak: '03-10', bloom_end: '04-01' },
      { name: 'Chestnut',                     bloom_start: '05-15', bloom_peak: '06-10', bloom_end: '06-30' },
      { name: 'Lavender & Thyme',             bloom_start: '05-15', bloom_peak: '06-20', bloom_end: '08-01' },
      { name: 'Sunflower',                    bloom_start: '06-15', bloom_peak: '07-20', bloom_end: '08-31' },
      { name: 'Summer Heather & Savory',      bloom_start: '07-15', bloom_peak: '08-20', bloom_end: '10-01' },
    ],
  },

  easternAustralia: {
    name: 'Eastern Australia',
    baseZone: 9,
    plants: [
      { name: 'Coastal Banksia',              bloom_start: '06-01', bloom_peak: '08-15', bloom_end: '11-01' },
      { name: 'Ironbark & Box Eucalypts',     bloom_start: '06-01', bloom_peak: '07-20', bloom_end: '09-15' },
      { name: 'Canola (southern areas)',      bloom_start: '08-01', bloom_peak: '09-10', bloom_end: '10-15' },
      { name: 'Spring Eucalypts (Stringybark)', bloom_start: '09-01', bloom_peak: '10-15', bloom_end: '11-30' },
      { name: 'Tea Tree & Paperbark',         bloom_start: '10-01', bloom_peak: '11-10', bloom_end: '12-31' },
      { name: 'Lucerne / Alfalfa',            bloom_start: '11-01', bloom_peak: '12-15', bloom_end: '12-31' },
    ],
  },

  westernAustralia: {
    name: 'Western Australia',
    baseZone: 10,
    plants: [
      { name: 'Banksia (various)',            bloom_start: '05-15', bloom_peak: '08-01', bloom_end: '11-01' },
      { name: 'Canola (wheat belt)',          bloom_start: '05-15', bloom_peak: '06-20', bloom_end: '08-01' },
      { name: 'Wandoo Eucalyptus',            bloom_start: '07-01', bloom_peak: '08-20', bloom_end: '10-15' },
      { name: 'Jarrah',                       bloom_start: '10-01', bloom_peak: '11-15', bloom_end: '12-31' },
      { name: 'Marri',                        bloom_start: '11-15', bloom_peak: '12-20', bloom_end: '12-31' },
      { name: 'Summer Wildflowers',           bloom_start: '07-01', bloom_peak: '09-01', bloom_end: '11-30' },
    ],
  },
};

export function getRegionalProfile(lat: number, lng: number): RegionalProfile {
  // Australia: lat -10 to -45, lng 112-155
  if (lat < -10 && lat > -46 && lng > 112 && lng < 155) {
    if (lng < 130) return PROFILES.westernAustralia;
    return PROFILES.easternAustralia;
  }

  // New Zealand: lat -34 to -47, lng 165-179
  if (lat < -34 && lat > -48 && lng > 165) return PROFILES.easternAustralia;

  // Europe: lat 35-72, lng -11 to 42
  if (lat > 35 && lat < 72 && lng > -11 && lng < 42) {
    // Mediterranean (Spain, Portugal, S France, Italy, Greece, W Turkey)
    if (lat < 44) return PROFILES.mediterranean;
    // Northern Europe (UK, NL, Belgium, W France, Denmark, Scandinavia)
    if (lng < 10 || lat >= 55) return PROFILES.northernEurope;
    // Central/Eastern Europe (Germany, Poland, Czech, Austria, Hungary, Romania)
    return PROFILES.centralEurope;
  }

  // Florida subtropical
  if (lat < 29.5 && lng > -87.5) return PROFILES.florida;

  // South Texas / Gulf brush country
  if (lat < 31 && lng >= -100 && lng < -93) return PROFILES.southTexas;

  // Southwest Arid Desert (AZ, NM, S NV, S UT, W TX)
  if (lng < -100 && lat < 38) return PROFILES.southwestArid;

  // California (west of Sierra Nevada / Cascade crest)
  if (lat >= 32 && lat < 42 && lng < -113) return PROFILES.california;

  // Pacific Northwest (WA, OR, N ID)
  if (lat >= 42 && lng < -113) return PROFILES.pacificNorthwest;

  // Mountain West (CO, UT, WY, MT, ID, E NV)
  if (lng >= -117 && lng < -103 && lat >= 35) return PROFILES.mountainWest;

  // Great Plains (ND–TX corridor, east of Rockies, west of Mississippi)
  if (lng >= -103 && lng < -95 && lat >= 29) return PROFILES.greatPlains;

  // Southeast (VA south to Gulf, east of Mississippi)
  if (lat < 38 && lng >= -95) return PROFILES.southeast;

  // Northeast (New England through mid-Atlantic)
  if (lat >= 38 && lng >= -80) return PROFILES.northeast;

  // Midwest — catch-all for central/north-central US
  return PROFILES.midwest;
}
