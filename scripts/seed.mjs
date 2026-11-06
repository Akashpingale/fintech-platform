/**
 * Regenerates db.json with demo data dated relative to today.
 *
 * Run with `npm run seed`. Dates are always anchored to the current month, so
 * the dashboard, budgets and analytics pages have data in their "this month"
 * windows no matter when the project is cloned.
 *
 * The random walk is seeded, so repeated runs produce the same file.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'db.json');

// ───────────────────────── seeded PRNG (mulberry32) ─────────────────────────
let seed = 20261106;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = list => list[Math.floor(random() * list.length)];
const between = (min, max) => Math.round(min + random() * (max - min));

// ───────────────────────────── date helpers ─────────────────────────────
const TODAY = new Date();
const iso = date => date.toISOString().slice(0, 10);
const monthKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
/** `monthsAgo(0)` is the current month. */
const monthsAgo = n => new Date(TODAY.getFullYear(), TODAY.getMonth() - n, 1);
const dayIn = (monthDate, day) => {
  const lastDay = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate();
  const safeDay = Math.min(day, lastDay);
  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), safeDay);
  // Never generate a future-dated transaction.
  return date > TODAY ? TODAY : date;
};
const daysAgo = n => new Date(TODAY.getTime() - n * 86400000);
const yearsFromNow = n =>
  new Date(TODAY.getFullYear() + n, TODAY.getMonth(), TODAY.getDate());

const USER_ID = 'u1';
const MONTHS_OF_HISTORY = 6;

// ───────────────────────────── users ─────────────────────────────
const users = [
  {
    id: USER_ID,
    name: 'Akash Pingale',
    email: 'akash@fintrack.in',
    // Plain text on purpose: this is a frontend-only mock with no auth server.
    // Never store credentials like this against a real backend.
    password: 'Demo@1234',
    currency: 'INR',
    monthlyIncome: 95000,
    riskProfile: 'moderate',
    avatar: '',
  },
];

// ───────────────────────────── transactions ─────────────────────────────
/** Recurring monthly expenses: [category, amount, day, method, note]. */
const FIXED = [
  ['Rent', 22000, 3, 'bank', 'Flat rent'],
  ['Bills', 3200, 7, 'upi', 'Electricity & water'],
  ['Bills', 799, 12, 'card', 'Broadband'],
  ['Transport', 2400, 5, 'upi', 'Metro pass'],
  ['Health', 1850, 15, 'card', 'Gym membership'],
];

/** Variable spends drawn each month: [category, min, max, methods, notes]. */
const VARIABLE = [
  ['Food', 280, 1400, ['upi', 'cash', 'card'], ['Groceries', 'Dinner out', 'Swiggy order', 'Cafe', 'Vegetables']],
  ['Shopping', 600, 4500, ['card', 'upi'], ['Clothes', 'Electronics', 'Home supplies', 'Footwear']],
  ['Entertainment', 200, 1600, ['upi', 'card'], ['Movie tickets', 'Streaming', 'Concert', 'Books']],
  ['Transport', 120, 900, ['upi', 'cash'], ['Cab ride', 'Fuel', 'Auto']],
  ['Education', 500, 3500, ['card'], ['Online course', 'Certification fee']],
  ['Health', 250, 2200, ['upi', 'card'], ['Pharmacy', 'Doctor visit', 'Lab test']],
  ['Food', 150, 700, ['cash', 'upi'], ['Tea & snacks', 'Office lunch']],
];

const transactions = [];
let txId = 1;
const addTx = tx => transactions.push({ id: `t${txId++}`, userId: USER_ID, ...tx });

for (let m = MONTHS_OF_HISTORY - 1; m >= 0; m--) {
  const month = monthsAgo(m);
  const isCurrentMonth = m === 0;

  // Salary — the first one carries the recurring flag so the app's recurring
  // generator has a template to work from.
  const salaryDate = dayIn(month, 1);
  if (!isCurrentMonth || TODAY.getDate() >= 1) {
    addTx({
      type: 'income',
      amount: 95000,
      category: 'Salary',
      date: iso(salaryDate),
      paymentMethod: 'bank',
      notes: 'Monthly salary credit',
      tags: ['salary'],
      ...(m === MONTHS_OF_HISTORY - 1
        ? { recurring: { frequency: 'monthly' } }
        : {}),
    });
  }

  // Occasional freelance income.
  if (random() > 0.45) {
    addTx({
      type: 'income',
      amount: between(8000, 26000),
      category: 'Freelance',
      date: iso(dayIn(month, between(9, 24))),
      paymentMethod: 'bank',
      notes: pick(['Website project', 'Consulting retainer', 'App build']),
      tags: ['side-income'],
    });
  }

  // Fixed monthly expenses.
  for (const [category, amount, day, method, note] of FIXED) {
    const date = dayIn(month, day);
    if (isCurrentMonth && date > TODAY) continue;
    addTx({
      type: 'expense',
      amount,
      category,
      date: iso(date),
      paymentMethod: method,
      notes: note,
      tags: ['fixed'],
      ...(m === MONTHS_OF_HISTORY - 1 && category === 'Rent'
        ? { recurring: { frequency: 'monthly' } }
        : {}),
    });
  }

  // Variable spends: more entries in full months than the partial current one.
  const variableCount = isCurrentMonth
    ? Math.max(3, Math.round((TODAY.getDate() / 30) * 9))
    : between(7, 11);

  for (let i = 0; i < variableCount; i++) {
    const [category, min, max, methods, notes] = pick(VARIABLE);
    const date = dayIn(month, between(2, 28));
    if (date > TODAY) continue;
    addTx({
      type: 'expense',
      amount: between(min, max),
      category,
      date: iso(date),
      paymentMethod: pick(methods),
      notes: pick(notes),
    });
  }
}

// ───────────────────────────── budgets ─────────────────────────────
const BUDGET_LIMITS = {
  Food: 12000,
  Rent: 22000,
  Transport: 4500,
  Shopping: 6000,
  Bills: 4500,
  Health: 4000,
  Education: 4000,
  Entertainment: 3000,
};

const budgets = [];
let budgetId = 1;
// Current and previous month, so "copy last month" has something to copy.
for (const offset of [1, 0]) {
  const month = monthKey(monthsAgo(offset));
  for (const [category, limit] of Object.entries(BUDGET_LIMITS)) {
    budgets.push({
      id: `b${budgetId++}`,
      userId: USER_ID,
      category,
      month,
      limit,
    });
  }
}

// ───────────────────────────── goals ─────────────────────────────
const goals = [
  {
    id: 'g1',
    userId: USER_ID,
    name: 'Emergency Fund',
    targetAmount: 300000,
    savedAmount: 186000,
    deadline: iso(yearsFromNow(1)),
    createdAt: iso(monthsAgo(14)),
  },
  {
    id: 'g2',
    userId: USER_ID,
    name: 'Europe Trip',
    targetAmount: 250000,
    savedAmount: 72500,
    deadline: iso(new Date(TODAY.getFullYear() + 1, TODAY.getMonth() + 5, 15)),
    createdAt: iso(monthsAgo(7)),
  },
  {
    id: 'g3',
    userId: USER_ID,
    name: 'New Laptop',
    targetAmount: 145000,
    savedAmount: 145000,
    deadline: iso(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 20)),
    createdAt: iso(monthsAgo(9)),
  },
  {
    id: 'g4',
    userId: USER_ID,
    name: 'Home Down Payment',
    targetAmount: 1500000,
    savedAmount: 215000,
    deadline: iso(yearsFromNow(4)),
    createdAt: iso(monthsAgo(11)),
  },
];

// ───────────────────────────── holdings ─────────────────────────────
const holdings = [
  {
    id: 'h1',
    userId: USER_ID,
    assetType: 'stock',
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    quantity: 14,
    avgBuyPrice: 2450,
    currentPrice: 2918.4,
    buyDate: iso(monthsAgo(29)),
  },
  {
    id: 'h2',
    userId: USER_ID,
    assetType: 'stock',
    symbol: 'INFY',
    name: 'Infosys',
    quantity: 25,
    avgBuyPrice: 1480,
    currentPrice: 1622.75,
    buyDate: iso(monthsAgo(20)),
  },
  {
    id: 'h3',
    userId: USER_ID,
    assetType: 'mutual_fund',
    symbol: 'PPFAS',
    name: 'Parag Parikh Flexi Cap Fund',
    quantity: 420.55,
    avgBuyPrice: 62.4,
    currentPrice: 78.9,
    buyDate: iso(monthsAgo(24)),
  },
  {
    id: 'h4',
    userId: USER_ID,
    assetType: 'crypto',
    symbol: 'BTC',
    name: 'Bitcoin',
    quantity: 0.045,
    avgBuyPrice: 4250000,
    currentPrice: 5380000,
    buyDate: iso(monthsAgo(15)),
  },
  {
    id: 'h5',
    userId: USER_ID,
    assetType: 'gold',
    symbol: 'SGBGOLD',
    name: 'Sovereign Gold Bond',
    quantity: 18,
    avgBuyPrice: 5820,
    currentPrice: 7140,
    buyDate: iso(monthsAgo(18)),
  },
  {
    id: 'h6',
    userId: USER_ID,
    assetType: 'fd',
    symbol: 'HDFCFD',
    name: 'HDFC Bank Fixed Deposit',
    quantity: 1,
    avgBuyPrice: 200000,
    currentPrice: 215600,
    buyDate: iso(monthsAgo(13)),
  },
  {
    id: 'h7',
    userId: USER_ID,
    assetType: 'bond',
    symbol: 'NHAIBOND',
    name: 'NHAI Tax-Free Bond',
    quantity: 60,
    avgBuyPrice: 1045,
    currentPrice: 1082.5,
    buyDate: iso(monthsAgo(10)),
  },
];

// ───────────────────────── asset transactions ─────────────────────────
const assetTransactions = [];
let atId = 1;
for (const holding of holdings) {
  // Opening buy.
  assetTransactions.push({
    id: `at${atId++}`,
    holdingId: holding.id,
    side: 'buy',
    quantity: holding.quantity,
    price: holding.avgBuyPrice,
    fees: Math.round(holding.avgBuyPrice * holding.quantity * 0.0012),
    date: holding.buyDate,
  });
}
// A couple of later top-ups and one partial sale, for the history view.
assetTransactions.push(
  {
    id: `at${atId++}`,
    holdingId: 'h1',
    side: 'buy',
    quantity: 4,
    price: 2710,
    fees: 14,
    date: iso(monthsAgo(8)),
  },
  {
    id: `at${atId++}`,
    holdingId: 'h3',
    side: 'buy',
    quantity: 80.55,
    price: 71.2,
    fees: 7,
    date: iso(monthsAgo(4)),
  },
  {
    id: `at${atId++}`,
    holdingId: 'h2',
    side: 'sell',
    quantity: 5,
    price: 1595,
    fees: 12,
    date: iso(monthsAgo(3)),
  }
);

// ───────────────────────────── SIPs ─────────────────────────────
const sips = [
  {
    id: 's1',
    userId: USER_ID,
    fundName: 'Parag Parikh Flexi Cap Fund',
    amount: 10000,
    dayOfMonth: 5,
    startDate: iso(monthsAgo(22)),
    durationMonths: 60,
    expectedReturn: 13.5,
  },
  {
    id: 's2',
    userId: USER_ID,
    fundName: 'UTI Nifty 50 Index Fund',
    amount: 6000,
    dayOfMonth: 12,
    startDate: iso(monthsAgo(11)),
    durationMonths: 120,
    expectedReturn: 11.5,
  },
  {
    id: 's3',
    userId: USER_ID,
    fundName: 'ICICI Pru Balanced Advantage',
    amount: 4000,
    dayOfMonth: 20,
    startDate: iso(monthsAgo(5)),
    durationMonths: 36,
    expectedReturn: 10,
  },
];

// ───────────────────────────── watchlist ─────────────────────────────
const watchlist = [
  { id: 'w1', userId: USER_ID, symbol: 'TCS', alertAbove: 4200, alertBelow: 3600 },
  { id: 'w2', userId: USER_ID, symbol: 'HDFCBANK', alertAbove: 1850 },
  { id: 'w3', userId: USER_ID, symbol: 'ETH', alertBelow: 180000 },
  { id: 'w4', userId: USER_ID, symbol: 'TATAMOTORS', alertAbove: 1100, alertBelow: 820 },
];

// ───────────────────────── market prices ─────────────────────────
const PRICES = {
  RELIANCE: 2918.4,
  INFY: 1622.75,
  PPFAS: 78.9,
  BTC: 5380000,
  SGBGOLD: 7140,
  HDFCFD: 215600,
  NHAIBOND: 1082.5,
  TCS: 4064.3,
  HDFCBANK: 1742.6,
  ETH: 214500,
  TATAMOTORS: 962.45,
  SOL: 15800,
};

const marketPrices = Object.entries(PRICES).map(([symbol, price]) => {
  const changePercent = Number(((random() - 0.45) * 3).toFixed(2));
  const change = Number(((price * changePercent) / 100).toFixed(2));
  return {
    symbol,
    price,
    change,
    changePercent,
    updatedAt: new Date().toISOString(),
  };
});

// ───────────────────────── notifications ─────────────────────────
// Seeded with a couple of historical entries; the app generates the rest from
// live budget/goal/SIP/price state on startup.
const notifications = [
  {
    id: 'n1',
    userId: USER_ID,
    type: 'goal',
    message: 'Goal reached: New Laptop is fully funded.',
    read: false,
    createdAt: daysAgo(2).toISOString(),
  },
  {
    id: 'n2',
    userId: USER_ID,
    type: 'sip',
    message: 'Your UTI Nifty 50 Index Fund SIP was debited successfully.',
    read: true,
    createdAt: daysAgo(9).toISOString(),
  },
];

// ───────────────────────────── write ─────────────────────────────
const db = {
  users,
  transactions,
  budgets,
  goals,
  holdings,
  assetTransactions,
  sips,
  watchlist,
  notifications,
  marketPrices,
};

writeFileSync(OUT, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort();
console.log(`Wrote ${OUT}`);
console.log(
  [
    `  users:             ${users.length}`,
    `  transactions:      ${transactions.length} (${months[0]} … ${months[months.length - 1]})`,
    `  budgets:           ${budgets.length}`,
    `  goals:             ${goals.length}`,
    `  holdings:          ${holdings.length}`,
    `  assetTransactions: ${assetTransactions.length}`,
    `  sips:              ${sips.length}`,
    `  watchlist:         ${watchlist.length}`,
    `  marketPrices:      ${marketPrices.length}`,
    `  notifications:     ${notifications.length}`,
  ].join('\n')
);
