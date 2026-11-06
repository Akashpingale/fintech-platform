/**
 * End-to-end smoke check.
 *
 * Signs in with the demo account, visits every route, and reports for each one:
 * the final URL, whether real content rendered, and any console or page errors.
 *
 * Requires the dev server on :4200 and json-server on :3000.
 * Run with: node scripts/verify.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const BASE = 'http://localhost:4200';

const ROUTES = [
  { path: '/dashboard', expect: 'Total net worth' },
  { path: '/transactions', expect: 'Transactions' },
  { path: '/transactions/new', expect: 'Add transaction' },
  { path: '/budgets', expect: 'Budgets' },
  { path: '/goals', expect: 'Savings goals' },
  { path: '/portfolio', expect: 'Portfolio value' },
  { path: '/watchlist', expect: 'Watchlist' },
  { path: '/sip', expect: 'SIP tracker' },
  { path: '/calculators/sip', expect: 'SIP calculator' },
  { path: '/calculators/lumpsum', expect: 'Lumpsum' },
  { path: '/calculators/emi', expect: 'Monthly instalment' },
  { path: '/calculators/fd', expect: 'Maturity amount' },
  { path: '/calculators/retirement', expect: 'Corpus you need' },
  { path: '/calculators/tax', expect: 'Income tax estimator' },
  { path: '/analytics', expect: 'Financial health score' },
  { path: '/reports', expect: 'Reports' },
  { path: '/notifications', expect: 'Notifications' },
  { path: '/settings', expect: 'Settings' },
  { path: '/no-such-page', expect: 'does not exist' },
];

const executablePath = CHROME_CANDIDATES.find(p => existsSync(p));
if (!executablePath) {
  console.error('No Chrome or Edge binary found. Checked:\n' + CHROME_CANDIDATES.join('\n'));
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();

/** Console errors and uncaught exceptions for the page currently under test. */
let problems = [];
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  // Favicon noise and the expected 404 for an unseeded price symbol are not bugs.
  if (/favicon|net::ERR_/i.test(text)) return;
  problems.push(`console: ${text}`);
});
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ─────────────────────────── 1. guard redirect ───────────────────────────
problems = [];
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 600));
record(
  'authGuard redirects an anonymous visitor to login',
  page.url().includes('/auth/login'),
  page.url().replace(BASE, '')
);

// ─────────────────────────── 2. sign in ───────────────────────────
problems = [];
await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.type('input[type="email"]', 'akash@fintrack.in');
await page.type('input[type="password"]', 'Demo@1234');
await Promise.all([
  page.waitForFunction(() => location.pathname.startsWith('/dashboard'), {
    timeout: 20000,
  }),
  page.click('button[type="submit"]'),
]);
await new Promise(r => setTimeout(r, 2500)); // let the data load settle
record('sign in with the demo account', page.url().includes('/dashboard'));

// ─────────────────────────── 3. every route ───────────────────────────
for (const route of ROUTES) {
  problems = [];
  await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2' });
  // Lazy chunk, data load, chart draw and count-up animation.
  await new Promise(r => setTimeout(r, 2000));

  // textContent rather than innerText: Chrome applies CSS text-transform to
  // innerText, so an uppercased label would not match the source string.
  const text = await page.evaluate(() =>
    (document.body.textContent ?? '').replace(/\s+/g, ' ')
  );
  const url = page.url().replace(BASE, '');
  const redirected = !url.startsWith(route.path);
  const found = text.toLowerCase().includes(route.expect.toLowerCase());
  const failed = problems.length > 0;

  const detail = [
    redirected ? `redirected to ${url}` : null,
    !found
      ? `missing "${route.expect}" — body starts: ${text.slice(0, 180)}`
      : null,
    failed ? problems.join(' || ') : null,
  ]
    .filter(Boolean)
    .join('; ');

  record(route.path, found && !redirected && !failed, detail);
}

// ─────────────────────── 4. charts actually drew ───────────────────────
problems = [];
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));
const canvasInfo = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  return {
    count: canvases.length,
    painted: canvases.filter(c => c.width > 0 && c.height > 0).length,
  };
});
record(
  'dashboard charts rendered',
  canvasInfo.count > 0 && canvasInfo.painted === canvasInfo.count,
  `${canvasInfo.painted}/${canvasInfo.count} canvases sized`
);

// ─────────────────────── 5. dark theme toggle ───────────────────────
problems = [];
const darkBefore = await page.evaluate(() =>
  document.body.classList.contains('dark-theme')
);
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button[aria-label]')];
  const toggle = buttons.find(b =>
    /switch to (light|dark) mode/i.test(b.getAttribute('aria-label') ?? '')
  );
  toggle?.click();
});
await new Promise(r => setTimeout(r, 700));
const darkAfter = await page.evaluate(() =>
  document.body.classList.contains('dark-theme')
);
record('theme toggle flips the dark class', darkBefore !== darkAfter,
  `${darkBefore} -> ${darkAfter}`);

// ─────────────────────── 6. mobile viewport ───────────────────────
problems = [];
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1200));
const mobile = await page.evaluate(() => {
  const sidebar = document.querySelector('.sidebar');
  const styles = sidebar ? getComputedStyle(sidebar) : null;
  return {
    bottomNav: styles?.position === 'fixed',
    horizontalOverflow:
      document.documentElement.scrollWidth > window.innerWidth + 2,
  };
});
record(
  'mobile layout: sidebar becomes a bottom bar, no horizontal scroll',
  mobile.bottomNav && !mobile.horizontalOverflow,
  `bottomNav=${mobile.bottomNav} overflow=${mobile.horizontalOverflow}`
);

// ─────────────── 7. write paths through the mock API ───────────────
await page.setViewport({ width: 1440, height: 900 });

// 7a. Create a transaction and confirm it reaches the list.
problems = [];
const marker = `verify-${Date.now()}`;
await page.goto(`${BASE}/transactions/new`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[formcontrolname="amount"]', { timeout: 15000 });
await page.evaluate(() => {
  const amount = document.querySelector('input[formcontrolname="amount"]');
  if (amount) {
    amount.value = '';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.type('input[formcontrolname="amount"]', '4321');
// Category is a mat-select: open it and pick the first option.
await page.click('mat-select[formcontrolname="category"]');
await page.waitForSelector('mat-option', { timeout: 8000 });
await page.click('mat-option');
await page.type('input[formcontrolname="notes"]', marker);
await Promise.all([
  page.waitForFunction(() => location.pathname === '/transactions', {
    timeout: 20000,
  }),
  page.click('button[type="submit"]'),
]);
await new Promise(r => setTimeout(r, 1500));

let listText = await page.evaluate(() => document.body.textContent ?? '');
const created = listText.includes(marker);
record('create a transaction (POST reaches the list)', created && problems.length === 0,
  problems.join(' || '));

// 7b. Confirm json-server actually persisted it, not just the local cache.
const persisted = await page.evaluate(async m => {
  const rows = await fetch('http://localhost:3000/transactions').then(r => r.json());
  return rows.some(t => t.notes === m);
}, marker);
record('transaction persisted to json-server', persisted);

// 7c. Delete it again and confirm it disappears.
problems = [];
const deleted = await page.evaluate(async m => {
  const rows = await fetch('http://localhost:3000/transactions').then(r => r.json());
  const row = rows.find(t => t.notes === m);
  if (!row) return false;
  await fetch(`http://localhost:3000/transactions/${row.id}`, { method: 'DELETE' });
  const after = await fetch('http://localhost:3000/transactions').then(r => r.json());
  return !after.some(t => t.notes === m);
}, marker);
record('delete the test transaction (DELETE)', deleted);

// 7d. Add a watchlist symbol, then remove it.
problems = [];
await page.goto(`${BASE}/watchlist`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[formcontrolname="symbol"]', { timeout: 15000 });
await page.type('input[formcontrolname="symbol"]', 'VERIFYSYM');
await page.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 1500));
const watchAdded = await page.evaluate(() =>
  (document.body.textContent ?? '').includes('VERIFYSYM')
);
record('add a watchlist symbol', watchAdded && problems.length === 0,
  problems.join(' || '));

await page.evaluate(async () => {
  const rows = await fetch('http://localhost:3000/watchlist').then(r => r.json());
  for (const row of rows.filter(w => w.symbol === 'VERIFYSYM')) {
    await fetch(`http://localhost:3000/watchlist/${row.id}`, { method: 'DELETE' });
  }
});

// 7e. Budget progress must reflect real transaction spend, not zero.
problems = [];
await page.goto(`${BASE}/budgets`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1800));
const budgetsLive = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('.progress__bar')];
  return bars.some(b => parseFloat(getComputedStyle(b).width) > 1);
});
record('budgets show real spend against limits', budgetsLive, problems.join(' || '));

// 7f. Live price feed is ticking.
problems = [];
await page.goto(`${BASE}/portfolio`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
const firstPrices = await page.evaluate(() =>
  [...document.querySelectorAll('.price-cell')].map(c => c.textContent?.trim())
);
await new Promise(r => setTimeout(r, 7000));
const laterPrices = await page.evaluate(() =>
  [...document.querySelectorAll('.price-cell')].map(c => c.textContent?.trim())
);
const ticked =
  firstPrices.length > 0 &&
  firstPrices.some((p, i) => p !== laterPrices[i]);
record('simulated live prices update', ticked,
  `${firstPrices.length} rows, changed=${ticked}`);

await browser.close();

const failures = results.filter(r => !r.ok);
console.log(
  `\n${results.length - failures.length}/${results.length} checks passed`
);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
