// Copy the LIVE database (read only) into Beekeeper Dev v2, so testers on the Preview site see
// their own records (Ron, 2026-09-29). Copies sign-in accounts (auth.users + auth.identities),
// every public table, and the stored photo/voice files.
//
// PRODUCTION IS NEVER CHANGED:
//  - its connection is switched to read-only mode before anything else, and verified;
//  - every production query must start with SELECT/WITH/SHOW, or the script stops;
//  - production files are only listed (from the database) and downloaded (GET).
// Beekeeper Dev v2 is wiped and refilled.
//
// Keys come from .env.copy in the project root (git-ignored; delete after use):
//   DEV_DB_PASSWORD, PROD_DB_PASSWORD, DEV_SERVICE_ROLE_KEY, PROD_SERVICE_ROLE_KEY
// The addresses are built here from each project's id and its Session pooler host.
// Usage: node scripts/copy-prod-to-dev.mjs --check   (reads both, writes nothing)
//        node scripts/copy-prod-to-dev.mjs --run     (wipes Dev v2, copies)
//        node scripts/copy-prod-to-dev.mjs --files   (re-runs only the resumable file step)

import pg from 'pg';

const PROD_REF = 'ayeqrbcvihztxbrxmrth';
const DEV_REF = 'byqznixioptovxvvonww';
const PROD_API = `https://${PROD_REF}.supabase.co`;
const DEV_API = `https://${DEV_REF}.supabase.co`;
const AUTH_TABLES = ['users', 'identities'];

const mode = process.argv[2];
if (!['--check', '--run', '--files'].includes(mode)) throw new Error('Usage: --check, --run, or --files');
process.loadEnvFile('.env.copy');
const { PROD_DB_PASSWORD, DEV_DB_PASSWORD, PROD_SERVICE_ROLE_KEY, DEV_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ PROD_DB_PASSWORD, DEV_DB_PASSWORD, PROD_SERVICE_ROLE_KEY, DEV_SERVICE_ROLE_KEY })) if (!v) throw new Error(`${k} missing in .env.copy`);
// Session pooler (works on IPv4 networks). Dev v2's host is from its Connect panel; both
// projects are in us-east-2 — PROD_DB_HOST in .env.copy overrides if production's differs.
const poolerUrl = (ref, password, host) => `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`;
const DEV_DB_URL = poolerUrl('byqznixioptovxvvonww', DEV_DB_PASSWORD, process.env.DEV_DB_HOST || 'aws-1-us-east-2.pooler.supabase.com');
const PROD_DB_URL = poolerUrl('ayeqrbcvihztxbrxmrth', PROD_DB_PASSWORD, process.env.PROD_DB_HOST || 'aws-1-us-east-2.pooler.supabase.com');

// ---------- which database is which ----------
if (!PROD_DB_URL.includes(PROD_REF) || PROD_DB_URL.includes(DEV_REF)) throw new Error('PROD_DB_URL is not the live database');
if (!DEV_DB_URL.includes(DEV_REF) || DEV_DB_URL.includes(PROD_REF)) throw new Error('DEV_DB_URL is not Beekeeper Dev v2 — refusing to write');
const keyRef = key => {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).ref ?? null;
  } catch {
    return null; // new-style secret keys carry no project id; they only work on their own project
  }
};
if (keyRef(PROD_SERVICE_ROLE_KEY) && keyRef(PROD_SERVICE_ROLE_KEY) !== PROD_REF) throw new Error('PROD_SERVICE_ROLE_KEY belongs to another project');
if (keyRef(DEV_SERVICE_ROLE_KEY) && keyRef(DEV_SERVICE_ROLE_KEY) !== DEV_REF) throw new Error('DEV_SERVICE_ROLE_KEY belongs to another project');

// ---------- connections ----------
const ssl = { rejectUnauthorized: false };
const prodClient = new pg.Client({ connectionString: PROD_DB_URL, ssl });
const dev = new pg.Client({ connectionString: DEV_DB_URL, ssl });
await prodClient.connect();
await prodClient.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
await prodClient.query('SET default_transaction_read_only = on');
const ro = (await prodClient.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only;
if (ro !== 'on') throw new Error('Could not put the production connection in read-only mode — stopping');
/** The only way this script talks to production: reading statements only. */
async function prod(sql, params) {
  if (!/^\s*(select|with|show)\b/i.test(sql)) throw new Error(`Refusing a non-read statement on production: ${sql.slice(0, 40)}`);
  return prodClient.query(sql, params);
}
await dev.connect();
console.log(`Connected. Production read-only: ${ro}.`);

// ---------- what exists ----------
async function columns(q, schema, table) {
  const { rows } = await q(
    `select column_name, data_type, is_generated, identity_generation, is_nullable, column_default from information_schema.columns
     where table_schema = $1 and table_name = $2 order by ordinal_position`,
    [schema, table],
  );
  return rows;
}
const tableList = async (q, schema) =>
  (await q(`select table_name from information_schema.tables where table_schema = $1 and table_type = 'BASE TABLE' order by 1`, [schema])).rows.map(r => r.table_name);

const prodPublic = await tableList(prod, 'public');
const devPublicTables = await tableList((sql, p) => dev.query(sql, p), 'public');

const problems = [];
const plan = [];
for (const [schema, tables] of [['auth', AUTH_TABLES], ['public', prodPublic]]) {
  for (const t of tables) {
    const pc = await columns(prod, schema, t);
    const dc = await columns((sql, p) => dev.query(sql, p), schema, t);
    if (!dc.length) {
      problems.push(`${schema}.${t}: missing on Dev v2`);
      continue;
    }
    const key = c => `${c.column_name}:${c.data_type}`;
    const dn = new Set(dc.map(key));
    const pn = new Set(pc.map(key));
    const missingOnDev = [...pn].filter(x => !dn.has(x));
    // Extra Dev v2 columns (e.g. the Bloom feature's apiaries.ecoregion_*) are fine when they can
    // be left empty or have a default; the copied rows simply leave them unset.
    const blockingExtra = dc.filter(c => !pn.has(key(c)) && c.is_nullable === 'NO' && c.column_default == null && c.is_generated !== 'ALWAYS');
    if (missingOnDev.length || blockingExtra.length) {
      problems.push(`${schema}.${t}: columns differ — only live: [${missingOnDev.join(', ')}]; required only on dev: [${blockingExtra.map(key).join(', ')}]`);
      continue;
    }
    const extra = [...dn].filter(x => !pn.has(x));
    if (extra.length) console.log(`note: ${schema}.${t} has Dev v2-only columns, left empty: ${extra.join(', ')}`);
    const n = +(await prod(`select count(*)::int as n from ${schema}."${t}"`)).rows[0].n;
    const d = +(await dev.query(`select count(*)::int as n from ${schema}."${t}"`)).rows[0].n;
    plan.push({ schema, t, cols: pc, n, d });
  }
}
for (const t of devPublicTables) if (!prodPublic.includes(t)) console.log(`note: public.${t} exists only on Dev v2 — not emptied directly (a table linked to apiaries or accounts empties with them)`);

// Foreign-key order for loading public tables (parents first), from Dev v2's constraints.
const { rows: fks } = await dev.query(
  `select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent from pg_constraint c
   join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`,
);
const name = t => t.replace(/^public\./, '').replace(/"/g, '');
const publicPlan = plan.filter(p => p.schema === 'public');
const ordered = [];
const seen = new Set();
const visit = (t, stack = new Set()) => {
  if (seen.has(t) || stack.has(t)) return;
  stack.add(t);
  for (const f of fks) if (name(f.child) === t && name(f.parent) !== t) visit(name(f.parent), stack);
  seen.add(t);
  const p = publicPlan.find(x => x.t === t);
  if (p) ordered.push(p);
};
for (const p of publicPlan) visit(p.t);

// Storage: object list from each database (names only).
const prodObjects = (await prod(`select bucket_id, name, metadata->>'mimetype' as mime, (metadata->>'size')::bigint as size from storage.objects order by 1, 2`)).rows;
const devObjects = (await dev.query(`select bucket_id, name from storage.objects order by 1, 2`)).rows;
const prodBuckets = (await prod(`select id from storage.buckets order by 1`)).rows.map(r => r.id);
const devBuckets = (await dev.query(`select id from storage.buckets order by 1`)).rows.map(r => r.id);
for (const b of prodBuckets) if (!devBuckets.includes(b)) problems.push(`storage bucket "${b}" missing on Dev v2`);

// Triggers on Dev v2 that the load could fire (they are switched off during the load).
const { rows: trig } = await dev.query(
  `select event_object_schema || '.' || event_object_table as tbl, trigger_name from information_schema.triggers
   where event_object_schema in ('auth','public') order by 1, 2`,
);

console.log('\nTable                          live rows   dev rows now');
for (const p of [...plan.filter(x => x.schema === 'auth'), ...ordered]) console.log(`${`${p.schema}.${p.t}`.padEnd(30)} ${String(p.n).padStart(9)} ${String(p.d).padStart(12)}`);
const mb = prodObjects.reduce((s, o) => s + Number(o.size ?? 0), 0) / 1e6;
console.log(`\nFiles: live ${prodObjects.length} (${mb.toFixed(1)} MB) in [${prodBuckets.join(', ')}]; dev now ${devObjects.length}`);
console.log(`Dev v2 triggers (off during load): ${trig.map(r => `${r.tbl}/${r.trigger_name}`).join('; ') || 'none'}`);
if (problems.length) console.log(`\nPROBLEMS (copy will not run until fixed):\n - ${problems.join('\n - ')}`);

if (mode === '--check' || problems.length) {
  await prodClient.end();
  await dev.end();
  console.log(mode === '--check' ? '\nCheck only — nothing was written anywhere.' : '\nStopped — nothing was written.');
  process.exit(problems.length ? 1 : 0);
}

// ================= --run: wipe Dev v2 and copy (--files: only the file step) =================
const cols = p => p.cols.filter(c => c.is_generated !== 'ALWAYS').map(c => `"${c.column_name}"`).join(', ');
const overriding = p => (p.cols.some(c => c.identity_generation === 'ALWAYS') ? ' overriding system value' : '');

if (mode === '--run') {
console.log('\nWiping Dev v2 tables...');
await dev.query('begin');
// Only tables that exist on both. Dev v2-only reference data (Bloom's plants, zone_plants) is
// kept; Dev v2-only tables tied to apiaries/accounts empty through their links (cascade).
await dev.query(`truncate ${ordered.map(p => `public."${p.t}"`).join(', ')} cascade`);
// Normal rules while deleting, so each account's identities, sessions and tokens go with it.
await dev.query('delete from auth.users');
// Triggers and foreign-key checks off while loading (no new-user triggers or webhooks fire).
await dev.query('set local session_replication_role = replica');

console.log('Copying rows...');
for (const p of [...plan.filter(x => x.schema === 'auth'), ...ordered]) {
  const BATCH = 500;
  for (let off = 0; off < p.n; off += BATCH) {
    const { rows } = await prod(`select coalesce(json_agg(t), '[]'::json) as j from (select * from ${p.schema}."${p.t}" order by 1 limit ${BATCH} offset ${off}) t`);
    await dev.query(
      `insert into ${p.schema}."${p.t}" (${cols(p)})${overriding(p)} select ${cols(p)} from json_populate_recordset(null::${p.schema}."${p.t}", $1::json)`,
      [JSON.stringify(rows[0].j)],
    );
  }
  process.stdout.write(`  ${p.schema}.${p.t}: ${p.n}\n`);
}
// Keep id counters ahead of the copied rows.
const { rows: seqs } = await dev.query(
  `select n.nspname as schema, c.relname as tbl, a.attname as col, pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as seq
   from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
     and pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) is not null`,
);
for (const s of seqs) await dev.query(`select setval($1, greatest(coalesce((select max("${s.col}") from public."${s.tbl}"), 0), 1))`, [s.seq]);
await dev.query('commit');
}

// Files: download each live file (GET only) and upload it to Dev v2. Resumable: skips files
// already on Dev v2 at the same size, retries each transfer, lists any that still fail.
console.log('Copying files...');
const devHeaders = { Authorization: `Bearer ${DEV_SERVICE_ROLE_KEY}`, apikey: DEV_SERVICE_ROLE_KEY };
const devNow = (await dev.query(`select bucket_id, name, (metadata->>'size')::bigint as size from storage.objects`)).rows;
const liveKeys = new Set(prodObjects.map(o => `${o.bucket_id}/${o.name}`));
for (const b of devBuckets) {
  const stale = devNow.filter(o => o.bucket_id === b && !liveKeys.has(`${o.bucket_id}/${o.name}`)).map(o => o.name);
  for (let i = 0; i < stale.length; i += 100) {
    const r = await fetch(`${DEV_API}/storage/v1/object/${b}`, { method: 'DELETE', headers: { ...devHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: stale.slice(i, i + 100) }) });
    if (!r.ok) throw new Error(`dev file delete failed: ${r.status}`);
  }
  if (stale.length) console.log(`  removed ${stale.length} test-only files from ${b}`);
}
const have = new Map(devNow.map(o => [`${o.bucket_id}/${o.name}`, Number(o.size)]));
async function transfer(o) {
  const path = o.name.split('/').map(encodeURIComponent).join('/');
  const get = await fetch(`${PROD_API}/storage/v1/object/${o.bucket_id}/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${PROD_SERVICE_ROLE_KEY}`, apikey: PROD_SERVICE_ROLE_KEY } });
  if (!get.ok) throw new Error(`download ${get.status}`);
  const body = Buffer.from(await get.arrayBuffer());
  const put = await fetch(`${DEV_API}/storage/v1/object/${o.bucket_id}/${path}`, { method: 'POST', headers: { ...devHeaders, 'Content-Type': o.mime || 'application/octet-stream', 'x-upsert': 'true' }, body });
  if (!put.ok) throw new Error(`upload ${put.status}: ${(await put.text()).slice(0, 120)}`);
}
let copied = 0;
let skipped = 0;
const failed = [];
for (const o of prodObjects) {
  if (have.get(`${o.bucket_id}/${o.name}`) === Number(o.size)) {
    skipped++;
    continue;
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transfer(o);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  if (lastErr) failed.push(`${(Number(o.size) / 1e6).toFixed(1)} MB ${o.mime}: ${lastErr.message}`);
  else if (++copied % 20 === 0) console.log(`  files copied: ${copied}`);
}
console.log(`  files: ${copied} copied, ${skipped} already there, ${failed.length} failed`);
for (const f of failed) console.log(`  FAILED ${f}`);

// Verify.
console.log('\nVerifying...');
let bad = 0;
for (const p of [...plan.filter(x => x.schema === 'auth'), ...ordered]) {
  const d = +(await dev.query(`select count(*)::int as n from ${p.schema}."${p.t}"`)).rows[0].n;
  if (d !== p.n) (bad++, console.log(`  MISMATCH ${p.schema}.${p.t}: live ${p.n}, dev ${d}`));
}
const devFiles = +(await dev.query('select count(*)::int as n from storage.objects')).rows[0].n;
if (devFiles !== prodObjects.length) (bad++, console.log(`  MISMATCH files: live ${prodObjects.length}, dev ${devFiles}`));
console.log(bad ? `\n${bad} mismatch(es) — see above.` : `\nAll row counts and ${devFiles} files match.`);
await prodClient.end();
await dev.end();
