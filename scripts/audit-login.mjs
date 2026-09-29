// Visual audit, step 1: open Edge on the local app so Ron signs in himself (test database), then
// save that browser session for the capture script. The saved file holds a sign-in token: it is
// written outside the project (AUDIT_DIR) and deleted after the audit.
import { chromium } from '@playwright/test';

const AUDIT_DIR = process.env.AUDIT_DIR;
if (!AUDIT_DIR) throw new Error('Set AUDIT_DIR');

const browser = await chromium.launch({ channel: 'msedge', headless: false });
const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await context.newPage();
await page.goto('http://localhost:5173/');
console.log('Waiting for sign-in in the Edge window (up to 5 minutes)...');
await page.waitForFunction(() => !!localStorage.getItem('tbh_v2_session'), null, { timeout: 5 * 60 * 1000, polling: 1000 });
await context.storageState({ path: `${AUDIT_DIR}/auth.json` });
console.log('Signed in; session saved.');
await browser.close();
