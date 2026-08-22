// Generates supabase/migrations/0009_seed_zone_plants.sql from the curated zone lists.
// Hand-writing ~50 INSERT rows invites typos; this keeps the data in one readable
// structure and emits the SQL from it.
//
// Inclusion rule (Ron, 2026-08-20): a plant earns a place only if a beekeeper would want
// to know it is blooming BECAUSE IT MIGHT MEAN NECTAR. Abundance is not the criterion.
// Wind-pollinated species are excluded however dominant: cottonwood, Siberian elm, oak,
// pinon, juniper, mountain mahogany. Yucca is excluded too (yucca moths, not honeybees).
import { writeFileSync } from 'node:fs';

export const PLANTS = {
  'Alfalfa':                   'Medicago sativa',
  'Russian Olive':             'Elaeagnus angustifolia',
  'Salt Cedar':                'Tamarix ramosissima',
  'Chamisa (Rubber Rabbitbrush)': 'Ericameria nauseosa',
  'Yellow Sweet Clover':       'Melilotus officinalis',
  'White Sweet Clover':        'Melilotus albus',
  'White Clover':              'Trifolium repens',
  'Willow':                    'Salix spp.',
  'Fruit Trees':               'Prunus / Malus spp.',
  'Sunflower':                 'Helianthus spp.',
  'Mexican Hat':               'Ratibida columnifera',
  'Desert Willow':             'Chilopsis linearis',
  'Russian Sage':              'Salvia yangii',
  'Snakeweed':                 'Gutierrezia sarothrae',
  'Desert Marigold':           'Baileya multiradiata',
  'New Mexico Locust':         'Robinia neomexicana',
  'Cholla':                    'Cylindropuntia spp.',
  'Apache Plume':              'Fallugia paradoxa',
  "Fendler's Ceanothus":       'Ceanothus fendleri',
  'Wild Bergamot':             'Monarda fistulosa',
  'Rocky Mountain Bee Plant':  'Cleome serrulata',
  'Tulip Poplar':              'Liriodendron tulipifera',
  'Black Locust':              'Robinia pseudoacacia',
  'Blackberry':                'Rubus spp.',
  'Privet':                    'Ligustrum sinense',
  'Goldenrod':                 'Solidago spp.',
  'Aster':                     'Symphyotrichum spp.',
  'Red Maple':                 'Acer rubrum',
  'Partridge Pea':             'Chamaecrista fasciculata',
  'Linden / Basswood':         'Tilia spp.',
  'Dandelion':                 'Taraxacum officinale',
};

const USDA = 'USDA NRCS Plant Materials Technical Note 71 (Los Lunas PMC)';
const NMSU = 'NMSU Honey Bees in New Mexico';
const NABA = 'Nashville Area Beekeepers Association';
const CSBA = 'Colorado State Beekeepers Association / regional sources';
const RON  = 'Ron Nolte field observation 2026-08';
const INFER = 'Inferred from regional flora - NOT yet validated';

// [plant, bloom_start, bloom_peak, bloom_end, nectar_value, source, confidence]
export const ZONES = {
  '22g': {
    name: 'Rio Grande Floodplain',
    rows: [
      ['Alfalfa',                     '05-01','06-15','09-15', 0.9, NMSU + ' + ' + RON, 'high'],
      ['Russian Olive',               '05-01','05-20','06-15', 0.9, NMSU, 'high'],
      ['Salt Cedar',                  '04-15','06-15','09-15', 0.7, NMSU, 'high'],
      ['Chamisa (Rubber Rabbitbrush)','08-15','09-15','10-31', 0.9, USDA + ' + ' + RON, 'high'],
      ['Yellow Sweet Clover',         '05-01','06-01','07-15', 0.9, USDA, 'medium'],
      ['White Clover',                '04-15','06-01','09-15', 0.5, NMSU, 'medium'],
      ['Willow',                      '02-15','03-10','04-05', 0.5, USDA, 'medium'],
      ['Fruit Trees',                 '03-10','04-01','04-25', 0.5, USDA, 'medium'],
      ['Sunflower',                   '07-01','08-15','09-30', 0.5, USDA, 'medium'],
      ['Mexican Hat',                 '06-01','07-15','09-15', 0.3, USDA + ' + ' + RON, 'high'],
    ],
  },
  '22m': {
    name: 'Albuquerque Basin',
    rows: [
      ['Chamisa (Rubber Rabbitbrush)','08-15','09-15','10-31', 0.9, USDA, 'high'],
      ['Yellow Sweet Clover',         '05-01','06-01','07-15', 0.9, USDA, 'medium'],
      ['Alfalfa',                     '05-01','06-15','09-15', 0.9, NMSU, 'medium'],
      ['Desert Willow',               '06-01','07-01','08-15', 0.5, NMSU, 'medium'],
      ['Russian Sage',                '06-01','07-15','09-15', 0.5, NMSU, 'medium'],
      ['Sunflower',                   '07-01','08-15','09-30', 0.5, USDA, 'medium'],
      ['Snakeweed',                   '08-15','09-15','10-31', 0.5, USDA, 'medium'],
      ['Fruit Trees',                 '03-10','04-01','04-25', 0.5, USDA, 'medium'],
      ['Desert Marigold',             '04-01','06-01','10-31', 0.3, USDA, 'medium'],
      ['Mexican Hat',                 '06-01','07-15','09-15', 0.3, USDA, 'medium'],
    ],
  },
  '23e': {
    name: 'Conifer Woodlands and Savannas',
    rows: [
      ['New Mexico Locust',           '05-10','06-01','06-30', 0.9, USDA, 'medium'],
      ['Chamisa (Rubber Rabbitbrush)','08-20','09-20','10-31', 0.9, USDA, 'medium'],
      ['Cholla',                      '05-01','05-25','06-30', 0.7, RON, 'medium'],
      ['Apache Plume',                '05-01','06-15','09-15', 0.5, USDA, 'medium'],
      ["Fendler's Ceanothus",         '05-15','06-15','07-15', 0.5, INFER, 'low'],
      ['Wild Bergamot',               '06-15','07-15','08-31', 0.5, USDA, 'low'],
      ['Rocky Mountain Bee Plant',    '06-15','07-20','08-31', 0.5, USDA, 'medium'],
      ['Sunflower',                   '07-01','08-15','09-30', 0.5, USDA, 'medium'],
      ['Snakeweed',                   '08-15','09-15','10-31', 0.5, USDA, 'medium'],
      ['Fruit Trees',                 '04-01','04-20','05-15', 0.5, INFER, 'low'],
    ],
  },
  '71i': {
    name: 'Inner Nashville Basin',
    rows: [
      ['Tulip Poplar',                '04-15','05-05','05-31', 0.9, NABA, 'high'],
      ['Black Locust',                '04-01','04-08','04-25', 0.9, NABA, 'high'],
      ['White Clover',                '04-20','05-26','08-15', 0.9, NABA, 'high'],
      ['Blackberry',                  '04-25','05-15','06-05', 0.9, NABA, 'high'],
      ['Privet',                      '05-01','05-15','05-31', 0.7, NABA, 'high'],
      ['Goldenrod',                   '08-01','09-01','10-31', 0.9, NABA + ' + ' + RON, 'high'],
      ['Aster',                       '09-01','10-01','11-05', 0.5, NABA, 'high'],
      ['Red Maple',                   '02-10','02-23','03-20', 0.5, NABA, 'high'],
      ['Fruit Trees',                 '03-01','04-01','04-25', 0.5, NABA, 'high'],
      ['Partridge Pea',               '07-01','08-15','09-30', 0.5, INFER, 'low'],
    ],
  },
  '25d': {
    name: 'Flat to Rolling Plains (Front Range)',
    rows: [
      ['Alfalfa',                     '06-01','07-01','09-15', 0.9, CSBA, 'high'],
      ['White Sweet Clover',          '06-01','07-01','08-15', 0.9, CSBA, 'high'],
      ['Yellow Sweet Clover',         '05-15','06-15','07-31', 0.9, CSBA, 'medium'],
      ['Russian Olive',               '05-10','05-30','06-20', 0.7, CSBA, 'medium'],
      ['Linden / Basswood',           '06-10','06-25','07-10', 0.7, CSBA, 'medium'],
      ['Dandelion',                   '03-15','04-20','05-31', 0.5, CSBA, 'high'],
      ['Fruit Trees',                 '04-10','05-01','05-25', 0.5, CSBA, 'high'],
      ['Sunflower',                   '07-01','08-15','09-30', 0.5, CSBA, 'medium'],
      ['Chamisa (Rubber Rabbitbrush)','08-15','09-15','10-15', 0.5, CSBA, 'medium'],
      ['Goldenrod',                   '08-01','09-01','09-30', 0.5, CSBA, 'high'],
    ],
  },
};

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

let sql = `-- ============================================================================
-- Seed plant lists for the ecoregions Ron's users actually occupy.
--
-- GENERATED by scripts/gen-seed-zone-plants.mjs - edit that and regenerate rather
-- than editing this file by hand.
--
-- Zone selection: of the 13 located apiaries in the database, these five Level IV
-- ecoregions cover nine. The remaining four are one apiary each and follow later.
--
-- Inclusion rule: a plant earns a place only if a beekeeper would want to know it is
-- blooming BECAUSE IT MIGHT MEAN NECTAR. Abundance is not the criterion, so
-- wind-pollinated species are excluded however dominant - cottonwood and Siberian elm
-- in Albuquerque, pinon, juniper, Gambel oak and mountain mahogany in the Sandias.
-- Yucca is excluded as well: it is pollinated by yucca moths, not honeybees.
--
-- confidence='low' rows are shipped deliberately. A visible, wrong entry invites
-- correction; a missing one is invisible. 23e is the weakest list and most needs
-- review by a beekeeper who works that zone.
--
-- Bloom windows are calendar priors. GDD columns are intentionally left null and are
-- populated later, at which point the dates become elastic to the actual season -
-- which is the whole point of GDD in a year like 2026, when a 90F March pulled
-- Albuquerque bloom weeks early.
--
-- Idempotent: safe to re-run. Apply to "Beekeeper Dev v2" first.
-- ============================================================================

`;

sql += '-- Species master.\n';
for (const [common, sci] of Object.entries(PLANTS)) {
  sql += `insert into public.plants (common_name, scientific_name) values (${q(common)}, ${q(sci)})\n  on conflict (lower(common_name)) do nothing;\n`;
}

sql += '\n';
for (const [code, zone] of Object.entries(ZONES)) {
  sql += `\n-- ${code} ${zone.name}\n`;
  for (const [plant, s, p, e, nectar, source, conf] of zone.rows) {
    if (!PLANTS[plant]) throw new Error('Unknown plant: ' + plant);
    sql += `insert into public.zone_plants (zone_level, zone_code, plant_id, bloom_start, bloom_peak, bloom_end, nectar_value, source, confidence)\n` +
           `  select 'l4', ${q(code)}, id, ${q(s)}, ${q(p)}, ${q(e)}, ${nectar}, ${q(source)}, ${q(conf)}\n` +
           `  from public.plants where lower(common_name) = lower(${q(plant)})\n` +
           `  on conflict (zone_level, coalesce(zone_code, ''), plant_id) do nothing;\n`;
  }
}

const out = 'E:/claude/beeks/supabase/migrations/0009_seed_zone_plants.sql';
writeFileSync(out, sql);
const rows = Object.values(ZONES).reduce((a, z) => a + z.rows.length, 0);
console.log(`wrote ${out}`);
console.log(`${Object.keys(PLANTS).length} species, ${Object.keys(ZONES).length} zones, ${rows} zone rows`);
