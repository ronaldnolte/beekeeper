// Visual audit, step 2: capture every screen in golden/screenshots/INDEX.md from the local app
// (test database) at the same phone size — 390 × 844 CSS px at 2×, Android Chrome user agent —
// so each can be compared side by side with the live-app screenshot of the same name.
// Nothing here saves, deletes or sends. Usage: AUDIT_DIR=... node scripts/audit-capture.mjs [ids]
import { chromium } from '@playwright/test';

const AUDIT_DIR = process.env.AUDIT_DIR;
if (!AUDIT_DIR) throw new Error('Set AUDIT_DIR');
const BASE = 'http://localhost:5173';
const only = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

const browser = await chromium.launch({ channel: 'msedge' });
const results = [];

async function newPage({ signedIn, whatsNewSeen = true }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    storageState: signedIn ? `${AUDIT_DIR}/auth.json` : undefined,
  });
  // Keep analytics out of it, as the golden capture did.
  await context.route(/googletagmanager|google-analytics/, r => r.abort());
  if (whatsNewSeen) await context.addInitScript(() => localStorage.setItem('beek_whats_new_seen', '2026-09-nectar-charts'));
  const page = await context.newPage();
  return page;
}

async function shot(page, id, opts = {}) {
  if (only.length && !only.some(o => id.startsWith(o))) return;
  await page.waitForTimeout(opts.settle ?? 700);
  await page.screenshot({ path: `${AUDIT_DIR}/${id}.png`, fullPage: !!opts.fullPage });
  results.push(id);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`FAILED ${name}: ${String(err.message).split('\n')[0]}`);
  }
}

const want = prefix => !only.length || only.some(o => o.startsWith(prefix) || prefix.startsWith(o.slice(0, 1)));

// ---------- signed out ----------
if (want('A')) {
  await step('A01–A04', async () => {
    const p = await newPage({ signedIn: false });
    await p.goto(BASE);
    await p.getByRole('button', { name: /log in/i }).waitFor();
    await shot(p, 'A01-sign-in');
    await p.getByText('Create Account', { exact: true }).click();
    await shot(p, 'A02-create-account');
    await p.locator('input[type=email]').fill('someone@example.com');
    for (const pw of await p.locator('input[type=password]').all()) await pw.fill('12345');
    await p.getByRole('button', { name: /sign up|create/i }).last().click();
    await shot(p, 'A03-create-account-password-too-short');
    await p.goto(BASE);
    await p.getByText('Forgot Password?').click();
    await shot(p, 'A04-forgot-password');
    await p.context().close();
  });
  await step('A05', async () => {
    const p = await newPage({ signedIn: false });
    await p.goto(`${BASE}/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
    await shot(p, 'A05-sign-in-link-error', { settle: 1200 });
    await p.context().close();
  });
  await step('A06', async () => {
    const p = await newPage({ signedIn: false });
    await p.goto(`${BASE}/beta`);
    await shot(p, 'A06-join-the-beta', { settle: 1200 });
    await p.context().close();
  });
  await step('A07–A08', async () => {
    const p = await newPage({ signedIn: false });
    await p.goto(`${BASE}/auth/update-password`);
    await shot(p, 'A07-set-new-password-verifying', { settle: 300 });
    await shot(p, 'A08-set-new-password-link-expired', { settle: 4500 });
    await p.context().close();
  });
  await step('A09–A10', async () => {
    const p = await newPage({ signedIn: false });
    await p.goto(`${BASE}/privacy.html`);
    await shot(p, 'A09-privacy-policy', { fullPage: true });
    await p.goto(`${BASE}/delete-account.html`);
    await shot(p, 'A10-delete-account-page', { fullPage: true });
    await p.context().close();
  });
}

// ---------- signed in ----------
if (want('B')) {
  const nav = (p, label) => p.locator('nav').getByText(label, { exact: true }).click();

  await step('B01–B02, B37–B38', async () => {
    const p = await newPage({ signedIn: true, whatsNewSeen: false });
    await p.goto(BASE);
    await p.getByText("What's New").first().waitFor();
    await shot(p, 'B01-whats-new');
    await p.getByRole('button', { name: 'Got it!' }).click();
    await p.getByText('My Upcoming Tasks').waitFor();
    await shot(p, 'B02-dashboard', { settle: 1200 });
    await p.getByRole('button', { name: /New Task/ }).click();
    await shot(p, 'B37-new-task-sheet');
    await p.keyboard.press('Escape');
    await p.mouse.wheel(0, 2000);
    await shot(p, 'B38-dashboard-scrolled');
    await p.context().close();
  });

  await step('B03–B04', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await nav(p, 'Forecast');
    await shot(p, 'B03-forecast-select-apiary', { settle: 1200 });
    await nav(p, 'Ask AI');
    await shot(p, 'B04-ask-ai-select-apiary', { settle: 1200 });
    await p.context().close();
  });

  await step('B05–B12', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await nav(p, 'Nectar');
    await shot(p, 'B05-nectar-which-yard', { settle: 1200 });
    await p.getByText('South Valley').first().click();
    await shot(p, 'B06-nectar-loading', { settle: 400 });
    await p.getByText('DIFFERENCE FROM NORMAL', { exact: false }).waitFor({ timeout: 90_000 });
    await shot(p, 'B07-nectar-chart', { settle: 1500 });
    await p.getByRole('button', { name: 'What is behind this number' }).click();
    await shot(p, 'B08-nectar-details');
    await p.locator('[role=dialog] button[aria-expanded]').first().click();
    await shot(p, 'B09-nectar-details-expanded');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const chart = p.getByRole('img', { name: 'Nectar index this season against the normal' }).first();
    const box = await chart.boundingBox();
    await p.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await shot(p, 'B10-nectar-hover');
    await p.mouse.move(5, 5);
    await p.getByRole('button', { name: 'Full screen' }).click();
    await shot(p, 'B11-nectar-fullscreen', { settle: 1200 });
    await step('B12 season', async () => {
      await p.getByRole('button', { name: 'Season' }).click();
      await shot(p, 'B12-nectar-fullscreen-season', { settle: 1000 });
    });
    await p.context().close();
  });

  await step('B13–B16', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await nav(p, 'Forecast');
    await p.getByText('South Valley').first().click();
    await p.getByText(/How are these scores calculated|How Scores are Calculated|scores/i).first().waitFor({ timeout: 30_000 });
    await shot(p, 'B13-forecast', { settle: 1500 });
    await p.locator('main table button, main [role=grid] button, main td button').first().click();
    await shot(p, 'B14-forecast-cell-detail');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
    await p.locator('main button.underline').first().click();
    await shot(p, 'B15-forecast-guide');
    await p.goto(BASE);
    await nav(p, 'Ask AI');
    await p.getByText('South Valley').first().click();
    await shot(p, 'B16-ask-ai', { settle: 1200 });
    await p.context().close();
  });

  await step('B17–B25', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await nav(p, 'Apiaries');
    await shot(p, 'B17-apiaries', { settle: 1200 });
    await p.getByRole('button', { name: 'More actions' }).first().click();
    await shot(p, 'B18-apiary-actions');
    await p.getByRole('button', { name: /Edit/ }).first().click();
    await shot(p, 'B19-apiary-edit-form', { settle: 1000 });
    await step('B20 map', async () => {
      await p.getByRole('button', { name: /Pick apiary location|map/i }).first().click();
      await shot(p, 'B20-map-picker', { settle: 3000 });
      await p.getByRole('button', { name: 'Close map' }).click();
    });
    await p.keyboard.press('Escape');
    await p.goto(BASE);
    await nav(p, 'Apiaries');
    await p.getByText('South Valley').first().click();
    await shot(p, 'B21-hives-in-apiary', { settle: 1200 });
    await nav(p, 'Hives');
    await shot(p, 'B22-hives-unified', { settle: 1200 });
    await p.getByRole('button', { name: 'Edit' }).first().click();
    await shot(p, 'B23-hive-edit-form', { settle: 1000 });
    await p.keyboard.press('Escape');
    await p.getByText('TBH-1').first().click();
    await shot(p, 'B24-hive-detail', { settle: 1500 });
    await p.mouse.wheel(0, 900);
    await shot(p, 'B25-hive-detail-scrolled');
    await p.context().close();
  });

  await step('B26–B36', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await nav(p, 'Hives');
    await p.getByText('TBH-1').first().click();
    const bar = label => p.locator('nav').getByText(label, { exact: true }).click();
    await bar('Inspection');
    await shot(p, 'B26-inspections-list', { settle: 1500 });
    await p.getByText('Inspection', { exact: true }).nth(1).click().catch(async () => p.locator('main button:has-text("Inspection")').last().click());
    await p.getByText('Photos & Voice').waitFor();
    await shot(p, 'B27-inspection-form', { settle: 1000 });
    await p.mouse.wheel(0, 900);
    await shot(p, 'B28-inspection-form-scrolled');
    await p.mouse.wheel(0, -2000);
    await p.getByRole('button', { name: /Export \/ Share/ }).click();
    await shot(p, 'B29-export-share-sheet');
    await p.getByRole('button', { name: 'Close' }).click();
    await p.getByRole('button', { name: /Photos & Voice/ }).click();
    await shot(p, 'B30-photos-and-voice', { settle: 1500 });
    await p.getByText('Interventions', { exact: true }).click();
    await shot(p, 'B31-interventions-list', { settle: 1500 });
    await p.getByRole('button', { name: '+ Add Intervention' }).click();
    await shot(p, 'B32-intervention-form');
    await p.getByText('Varroa', { exact: true }).first().click();
    await shot(p, 'B33-varroa-list', { settle: 1500 });
    await p.mouse.wheel(0, 900);
    await shot(p, 'B34-varroa-list-scrolled');
    await p.mouse.wheel(0, -2000);
    await p.getByRole('button', { name: '+ Add Mite Test' }).click();
    await shot(p, 'B35-varroa-form');
    await p.getByText('Tasks', { exact: true }).first().click();
    await p.getByRole('button', { name: /New Task/ }).click();
    await shot(p, 'B36-task-sheet-from-hive');
    await p.context().close();
  });

  await step('B39–B44', async () => {
    const p = await newPage({ signedIn: true });
    await p.goto(BASE);
    await p.getByRole('button', { name: 'Your profile' }).click();
    await p.getByText('Signed in as').waitFor();
    await shot(p, 'B39-profile', { settle: 1000 });
    await p.mouse.wheel(0, 2000);
    await shot(p, 'B40-profile-scrolled');
    await p.getByRole('button', { name: 'Log out' }).click();
    await shot(p, 'B41-logout-confirm');
    await p.getByRole('button', { name: 'Stay signed in' }).click();
    await p.getByRole('button', { name: 'Send feedback' }).click();
    await shot(p, 'B42-feedback-dialog');
    await p.getByRole('button', { name: /View Roadmap/ }).click();
    await p.getByText('COMMUNITY REQUESTS', { exact: false }).waitFor();
    await shot(p, 'B43-roadmap', { settle: 1200 });
    await p.getByRole('button', { name: /Submit Idea/ }).first().click();
    await shot(p, 'B44-submit-idea');
    await p.context().close();
  });
}

await browser.close();
console.log(`captured ${results.length}: ${results.join(' ')}`);
