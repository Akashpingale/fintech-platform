/**
 * Captures screenshots of the main pages in light and dark themes.
 * Output: screenshots/<page>-<theme>.png
 *
 * Useful for the project report and the README. Run with:
 *   node scripts/screenshots.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
].find(p => existsSync(p));

if (!CHROME) {
  console.error('No Chrome or Edge binary found.');
  process.exit(1);
}

const BASE = 'http://localhost:4200';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['login', '/auth/login'],
  ['dashboard', '/dashboard'],
  ['transactions', '/transactions'],
  ['budgets', '/budgets'],
  ['goals', '/goals'],
  ['portfolio', '/portfolio'],
  ['watchlist', '/watchlist'],
  ['sip', '/sip'],
  ['analytics', '/analytics'],
  ['calculator-emi', '/calculators/emi'],
  ['calculator-tax', '/calculators/tax'],
  ['reports', '/reports'],
  ['notifications', '/notifications'],
  ['settings', '/settings'],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000 },
});
const page = await browser.newPage();

// Sign in once.
await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type="email"]');
await page.screenshot({ path: `${OUT}/login-light.png` });
await page.type('input[type="email"]', 'akash@fintrack.in');
await page.type('input[type="password"]', 'Demo@1234');
await Promise.all([
  page.waitForFunction(() => location.pathname.startsWith('/dashboard'), {
    timeout: 20000,
  }),
  page.click('button[type="submit"]'),
]);
await new Promise(r => setTimeout(r, 2500));

async function setTheme(dark) {
  await page.evaluate(wantDark => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark === wantDark) return;
    const buttons = [...document.querySelectorAll('button[aria-label]')];
    buttons
      .find(b => /switch to (light|dark) mode/i.test(b.getAttribute('aria-label') ?? ''))
      ?.click();
  }, dark);
  await new Promise(r => setTimeout(r, 600));
}

for (const theme of ['light', 'dark']) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await setTheme(theme === 'dark');

  for (const [name, path] of PAGES) {
    if (path.startsWith('/auth')) continue;
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1800));
    await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    console.log(`captured ${name}-${theme}.png`);
  }
}

// Mobile dashboard.
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1800));
await page.screenshot({ path: `${OUT}/dashboard-mobile.png` });
console.log('captured dashboard-mobile.png');

await browser.close();
console.log(`\nScreenshots written to ./${OUT}`);
