// Install-dialog screenshots for manifest.webmanifest, taken from the sign-in page (nothing
// personal). Needs the local dev server. Usage: node scripts/manifest-screenshots.mjs
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge' });
for (const [name, viewport, scale] of [['narrow', { width: 454, height: 610 }, 1], ['wide', { width: 1910, height: 909 }, 1]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: /log in/i }).waitFor();
  await page.addStyleTag({ content: 'html { scrollbar-gutter: auto !important; overflow: hidden !important; }' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `public/screenshots/${name}.png` });
  await page.close();
}
await browser.close();
