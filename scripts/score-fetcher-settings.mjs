// Which satellite fetch settings earn their place?
//
// Each was added during the hardening on reasoning alone. This scores them against the
// beekeeper ground truth in api/__tests__/groundTruth.ts — the SAME definitions the test
// suite enforces, so a setting cannot look good here and fail there.
//
// One setting varied at a time from the current develop baseline. Testing every combination
// would be 32 configurations across 3 sites; this is 6, which is the difference between ten
// minutes and an afternoon of Earth Engine calls.
//
// Usage:  npx tsx --env-file=.env scripts/score-fetcher-settings.mjs
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const bf = await import(pathToFileURL('E:/claude/beeks/api/_shared/bands-fetcher.ts').href);
const { CHECKS, summarise } = await import(pathToFileURL('E:/claude/beeks/api/__tests__/groundTruth.ts').href);

const SITES = {
  south_valley: { lat: 35.0385, lng: -106.7067 },
  murfreesboro: { lat: 35.796343, lng: -86.373778 },
  tijeras:      { lat: 35.1065, lng: -106.3623 },
};

const YEAR = new Date().getUTCFullYear();
const START = `${YEAR - 5}-01-01`;
const END = new Date().toISOString().slice(0, 10);

// minCoverage, scaleM, forageWeighted — the three the fetcher exposes. The cloud mask is
// not parameterised, so it cannot be tested without a code change; noted in the output.
const CONFIGS = [
  { id: 'develop baseline',   minCoverage: 0.20, scaleM: 60, forageWeighted: true  },
  { id: 'coverage 10%',       minCoverage: 0.10, scaleM: 60, forageWeighted: true  },
  { id: 'coverage 5%',        minCoverage: 0.05, scaleM: 60, forageWeighted: true  },
  { id: 'coverage 0%',        minCoverage: 0,    scaleM: 60, forageWeighted: true  },
  { id: 'no forage weight',   minCoverage: 0.20, scaleM: 60, forageWeighted: false },
  { id: '20 m resolution',    minCoverage: 0.20, scaleM: 20, forageWeighted: true  },
];

async function weatherFor(lat, lng) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${START}&end_date=${END}&daily=temperature_2m_max,temperature_2m_min` +
    `&hourly=dew_point_2m&temperature_unit=fahrenheit&timezone=auto`;
  const j = await (await fetch(url)).json();
  const out = {};
  for (let i = 0; i < j.daily.time.length; i++) {
    if (j.daily.temperature_2m_max[i] == null) continue;
    out[j.daily.time[i]] = {
      tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i],
      dew: null, _s: 0, _n: 0,
    };
  }
  for (let i = 0; i < j.hourly.time.length; i++) {
    const d = j.hourly.time[i].slice(0, 10);
    const v = j.hourly.dew_point_2m[i];
    if (v == null || !out[d]) continue;
    out[d]._s += v; out[d]._n++;
  }
  for (const d of Object.keys(out)) if (out[d]._n) out[d].dew = out[d]._s / out[d]._n;
  return out;
}

console.log('Fetching weather (once per site, shared across configs)...');
const weather = {};
for (const [slug, s] of Object.entries(SITES)) weather[slug] = await weatherFor(s.lat, s.lng);

const results = [];
for (const cfg of CONFIGS) {
  const perSite = {};
  let secs = 0, scenes = 0;
  for (const [slug, s] of Object.entries(SITES)) {
    const t0 = Date.now();
    const r = await bf.fetchMultiBandsDetailed(
      s.lat, s.lng, START, END, 4.83, cfg.minCoverage, cfg.scaleM, cfg.forageWeighted
    );
    secs += (Date.now() - t0) / 1000;
    const recs = r.records ?? r;
    scenes += recs.length;
    perSite[slug] = summarise(recs, weather[slug], s.lat);
  }

  const asserted = CHECKS.filter(c => !c.advisory);
  const passed = asserted.filter(c => c.run(perSite[c.site]));
  const failed = asserted.filter(c => !c.run(perSite[c.site]));
  const advisory = CHECKS.filter(c => c.advisory && c.run(perSite[c.site]));

  results.push({ cfg, perSite, passed: passed.length, total: asserted.length,
    failedIds: failed.map(c => c.id), advisory: advisory.length, secs, scenes });

  console.log(`  ${cfg.id.padEnd(20)} ${passed.length}/${asserted.length}` +
    ` (+${advisory} advisory)  ${scenes} scenes  ${secs.toFixed(0)}s` +
    (failed.length ? `  failing: ${failed.map(c => c.id).join(', ')}` : ''));
}

console.log('\n\n=== SCORES ===\n');
console.log('  config                asserted  advisory  scenes   secs   failing');
console.log('  ' + '-'.repeat(88));
for (const r of results) {
  console.log(
    `  ${r.cfg.id.padEnd(20)} ${String(r.passed + '/' + r.total).padStart(8)}` +
    `  ${String(r.advisory + '/2').padStart(8)}  ${String(r.scenes).padStart(6)}` +
    `  ${r.secs.toFixed(0).padStart(5)}   ${r.failedIds.join(', ') || '-'}`
  );
}

const base = results[0];
console.log('\n=== AGAINST THE BASELINE ===\n');
for (const r of results.slice(1)) {
  const d = r.passed - base.passed;
  const adv = r.advisory - base.advisory;
  console.log(`  ${r.cfg.id.padEnd(20)} ${d >= 0 ? '+' : ''}${d} asserted, ` +
    `${adv >= 0 ? '+' : ''}${adv} advisory, ${r.secs > base.secs ? '+' : ''}` +
    `${(r.secs - base.secs).toFixed(0)}s`);
}

// 2026 monthly per site, so a change that keeps the score but reshapes the season is visible.
console.log('\n=== 2026 MONTHLY, so a reshaped season is not hidden by an unchanged score ===');
for (const slug of Object.keys(SITES)) {
  console.log(`\n  ${slug}`);
  console.log('    ' + 'config'.padEnd(20) + ['Mar','Apr','May','Jun','Jul','Aug'].map(m => m.padStart(5)).join(''));
  for (const r of results) {
    const m = r.perSite[slug].byYear['2026'];
    if (!m) continue;
    console.log('    ' + r.cfg.id.padEnd(20) +
      ['Mar','Apr','May','Jun','Jul','Aug'].map(k => String(m[k] ?? '.').padStart(5)).join(''));
  }
}

writeFileSync('E:/claude/beeks/docs/fetcher-scores.json', JSON.stringify(
  results.map(r => ({ ...r.cfg, passed: r.passed, total: r.total, advisory: r.advisory,
    scenes: r.scenes, secs: Math.round(r.secs), failing: r.failedIds })), null, 2));
console.log('\nWrote docs/fetcher-scores.json');
console.log('\nNOT tested: the strict vegetation-only cloud mask. It is hardcoded in the');
console.log('fetcher rather than a parameter, so it needs a code change to vary.');
