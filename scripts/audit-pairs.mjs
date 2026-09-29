// Visual audit, step 3: one side-by-side image per screen (live left, rebuild right) in
// AUDIT_DIR/pairs, plus AUDIT_DIR/index.html showing them all. Usage: node scripts/audit-pairs.mjs [ids]
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const AUDIT_DIR = process.env.AUDIT_DIR;
const GOLDEN = 'E:/claude/beeks-spec/golden/screenshots';
if (!AUDIT_DIR) throw new Error('Set AUDIT_DIR');
mkdirSync(`${AUDIT_DIR}/pairs`, { recursive: true });
const only = process.argv.slice(2);

const ids = readdirSync(GOLDEN)
  .filter(f => f.endsWith('.png'))
  .map(f => f.replace('.png', ''))
  .filter(id => !only.length || only.some(o => id.startsWith(o)));
const b64 = path => `data:image/png;base64,${readFileSync(path).toString('base64')}`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
for (const id of ids) {
  let mine;
  try {
    mine = b64(`${AUDIT_DIR}/${id}.png`);
  } catch {
    console.log(`missing rebuild shot: ${id}`);
    continue;
  }
  await page.setContent(`<body style="margin:0;background:#888;font:bold 13px sans-serif">
    <div style="display:flex;gap:8px;padding:6px;align-items:flex-start">
      <figure style="margin:0;width:390px"><figcaption>LIVE ${id}</figcaption><img src="${b64(`${GOLDEN}/${id}.png`)}" style="width:390px"></figure>
      <figure style="margin:0;width:390px"><figcaption>REBUILD</figcaption><img src="${mine}" style="width:390px"></figure>
    </div></body>`);
  await page.screenshot({ path: `${AUDIT_DIR}/pairs/${id}.png`, fullPage: true });
}
await browser.close();

writeFileSync(
  `${AUDIT_DIR}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Visual audit</title><body style="background:#444;color:#fff;font:14px sans-serif">${readdirSync(`${AUDIT_DIR}/pairs`)
    .map(f => `<h3>${f}</h3><img src="pairs/${f}" style="max-width:100%">`)
    .join('')}</body>`,
);
console.log(`paired ${ids.length}`);
