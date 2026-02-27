/**
 * Playwright script to capture real app screenshots for the App Store video.
 *
 * Prerequisites:
 *   1. Client dev server running: cd client && npm run dev
 *   2. Run: node scripts/capture-screenshots.mjs
 *
 * Output: public/screenshots/{screen-id}.png (393x852 @ 3x = 1179x2556)
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(__dirname, '../public/screenshots');

const BASE_URL = 'http://localhost:5173/demo-screenshots';

const SCREENS = [
  'court-idle',
  'court-evidence',
  'court-verdict',
  'daily-mood',
  'daily-done',
  'calendar',
  'ai-plan',
];

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
  });

  for (const screen of SCREENS) {
    const page = await context.newPage();
    const url = `${BASE_URL}?screen=${screen}`;
    console.log(`Capturing: ${screen} ...`);

    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for animations to settle
    await page.waitForTimeout(3000);

    // For daily-mood, simulate selecting two moods before capture
    if (screen === 'daily-mood') {
      // Click the first two mood buttons in the grid
      const moodButtons = page.locator('[data-mood]');
      const count = await moodButtons.count();
      if (count >= 2) {
        await moodButtons.nth(0).click();
        await page.waitForTimeout(300);
        await moodButtons.nth(1).click();
        await page.waitForTimeout(1000);
      }
    }

    const outPath = path.join(SCREENSHOT_DIR, `${screen}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  Saved: ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll screenshots captured!');
}

captureScreenshots().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
