import {
  allocationByAssetType,
  budgetAdherence,
  budgetUsage,
  cagr,
  currentValue,
  diversificationScore,
  groupByCategory,
  healthScore,
  inMonth,
  investedValue,
  monthKey,
  monthlySavingNeeded,
  monthsUntil,
  netSavings,
  netWorth,
  percentChange,
  profitLoss,
  rebalanceSuggestions,
  recentMonthKeys,
  returnPercent,
  savingsRate,
  totalExpense,
  totalIncome,
  xirr,
} from './finance.utils';
import { Holding } from '../../core/models/holding.model';
import { Transaction } from '../../core/models/transaction.model';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: 'u1',
    type: partial.type ?? 'expense',
    amount: partial.amount ?? 100,
    category: partial.category ?? 'Food',
    date: partial.date ?? '2026-11-01',
    paymentMethod: partial.paymentMethod ?? 'upi',
    notes: partial.notes,
    tags: partial.tags,
    recurring: partial.recurring,
  };
}

function holding(partial: Partial<Holding>): Holding {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: 'u1',
    assetType: partial.assetType ?? 'stock',
    symbol: partial.symbol ?? 'TEST',
    name: partial.name ?? 'Test Asset',
    quantity: partial.quantity ?? 10,
    avgBuyPrice: partial.avgBuyPrice ?? 100,
    currentPrice: partial.currentPrice ?? 120,
    buyDate: partial.buyDate ?? '2025-01-01',
  };
}

describe('cash-flow helpers', () => {
  const rows = [
    tx({ type: 'income', amount: 90000, category: 'Salary' }),
    tx({ type: 'income', amount: 10000, category: 'Freelance' }),
    tx({ type: 'expense', amount: 22000, category: 'Rent' }),
    tx({ type: 'expense', amount: 8000, category: 'Food' }),
  ];

  it('sums income and expense separately', () => {
    expect(totalIncome(rows)).toBe(100000);
    expect(totalExpense(rows)).toBe(30000);
  });

  it('computes net savings as income minus expense', () => {
    expect(netSavings(rows)).toBe(70000);
  });

  it('computes savings rate as a percentage of income', () => {
    expect(savingsRate(rows)).toBe(70);
  });

  it('returns a zero savings rate when there is no income', () => {
    expect(savingsRate([tx({ type: 'expense', amount: 500 })])).toBe(0);
  });

  it('adds cash, portfolio and goals, then subtracts liabilities', () => {
    expect(netWorth(100, 200, 50)).toBe(350);
    expect(netWorth(100, 200, 50, 75)).toBe(275);
  });
});

describe('portfolio maths', () => {
  const position = holding({ quantity: 10, avgBuyPrice: 100, currentPrice: 130 });

  it('computes invested and current value', () => {
    expect(investedValue(position)).toBe(1000);
    expect(currentValue(position)).toBe(1300);
  });

  it('computes profit and loss', () => {
    expect(profitLoss(position)).toBe(300);
    expect(returnPercent(1000, 1300)).toBeCloseTo(30, 10);
  });

  it('treats a zero invested amount as a zero return rather than infinity', () => {
    expect(returnPercent(0, 500)).toBe(0);
  });

  it('computes CAGR', () => {
    // 1000 -> 1331 over 3 years is exactly 10% a year.
    expect(cagr(1000, 1331, 3)).toBeCloseTo(10, 6);
  });

  it('returns zero CAGR for a non-positive period or value', () => {
    expect(cagr(1000, 1331, 0)).toBe(0);
    expect(cagr(0, 1000, 3)).toBe(0);
  });

  it('allocates by asset type in descending value order', () => {
    const allocation = allocationByAssetType([
      holding({ assetType: 'stock', quantity: 1, currentPrice: 300 }),
      holding({ assetType: 'crypto', quantity: 1, currentPrice: 100 }),
    ]);
    expect(allocation[0].type).toBe('stock');
    expect(allocation[0].percent).toBeCloseTo(75, 6);
    expect(allocation[1].percent).toBeCloseTo(25, 6);
  });

  it('scores a single-asset portfolio as undiversified', () => {
    expect(diversificationScore([holding({})])).toBe(0);
  });

  it('scores a broad, even portfolio higher than a concentrated one', () => {
    const even = (['stock', 'crypto', 'fd', 'gold', 'bond', 'mutual_fund'] as const).map(
      assetType => holding({ assetType, quantity: 1, currentPrice: 100 })
    );
    const concentrated = [
      holding({ assetType: 'stock', quantity: 1, currentPrice: 1000 }),
      holding({ assetType: 'crypto', quantity: 1, currentPrice: 10 }),
    ];
    expect(diversificationScore(even)).toBeGreaterThan(
      diversificationScore(concentrated)
    );
    expect(diversificationScore(even)).toBe(100);
  });

  it('suggests buying what is underweight and selling what is overweight', () => {
    const actions = rebalanceSuggestions(
      [
        holding({ assetType: 'stock', quantity: 1, currentPrice: 800 }),
        holding({ assetType: 'fd', quantity: 1, currentPrice: 200 }),
      ],
      { stock: 50, fd: 50 }
    );
    const stock = actions.find(a => a.type === 'stock');
    const fd = actions.find(a => a.type === 'fd');
    expect(stock?.deltaAmount).toBeCloseTo(-300, 6);
    expect(fd?.deltaAmount).toBeCloseTo(300, 6);
  });

  it('ignores drift below one percentage point', () => {
    const actions = rebalanceSuggestions(
      [holding({ assetType: 'stock', quantity: 1, currentPrice: 1000 })],
      { stock: 100 }
    );
    expect(actions).toEqual([]);
  });
});

describe('xirr', () => {
  it('recovers a known 10% annual return', () => {
    const rate = xirr([
      { amount: -1000, date: new Date('2024-01-01') },
      { amount: 1100, date: new Date('2025-01-01') },
    ]);
    expect(rate).toBeCloseTo(10, 1);
  });

  it('handles several contributions', () => {
    const rate = xirr([
      { amount: -1000, date: new Date('2023-01-01') },
      { amount: -1000, date: new Date('2024-01-01') },
      { amount: 2400, date: new Date('2025-01-01') },
    ]);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(100);
  });

  it('returns zero when the flows never change sign', () => {
    expect(
      xirr([
        { amount: -100, date: new Date('2024-01-01') },
        { amount: -100, date: new Date('2025-01-01') },
      ])
    ).toBe(0);
  });

  it('returns zero for fewer than two flows', () => {
    expect(xirr([{ amount: -100, date: new Date() }])).toBe(0);
  });
});

describe('budget helpers', () => {
  it('computes usage as a percentage and allows overspend above 100', () => {
    expect(budgetUsage(400, 1000)).toBe(40);
    expect(budgetUsage(1500, 1000)).toBe(150);
  });

  it('treats a zero limit as zero usage rather than infinity', () => {
    expect(budgetUsage(100, 0)).toBe(0);
  });

  it('scores full adherence when every budget is within its limit', () => {
    expect(
      budgetAdherence([
        { spent: 500, limit: 1000 },
        { spent: 1000, limit: 1000 },
      ])
    ).toBe(100);
  });

  it('scores zero adherence at double the limit', () => {
    expect(budgetAdherence([{ spent: 2000, limit: 1000 }])).toBe(0);
  });

  it('returns a neutral score when nothing is budgeted', () => {
    expect(budgetAdherence([])).toBe(50);
  });
});

describe('health score', () => {
  it('awards 100 when every component is maxed out', () => {
    const result = healthScore({
      savingsRatePercent: 30,
      budgetAdherence: 100,
      diversification: 100,
      emergencyFundMonths: 6,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe('excellent');
  });

  it('awards 0 when every component is at its floor', () => {
    const result = healthScore({
      savingsRatePercent: 0,
      budgetAdherence: 0,
      diversification: 0,
      emergencyFundMonths: 0,
    });
    expect(result.score).toBe(0);
    expect(result.band).toBe('poor');
  });

  it('weights the four components 30/25/25/20', () => {
    const result = healthScore({
      savingsRatePercent: 30,
      budgetAdherence: 0,
      diversification: 0,
      emergencyFundMonths: 0,
    });
    expect(result.score).toBe(30);
    expect(result.components.map(c => c.weight)).toEqual([30, 25, 25, 20]);
  });

  it('caps components that exceed their target', () => {
    const result = healthScore({
      savingsRatePercent: 90,
      budgetAdherence: 100,
      diversification: 100,
      emergencyFundMonths: 24,
    });
    expect(result.score).toBe(100);
  });
});

describe('date and grouping helpers', () => {
  it('formats a month key as YYYY-MM', () => {
    expect(monthKey(new Date(2026, 10, 6))).toBe('2026-11');
    expect(monthKey('2026-02-15')).toBe('2026-02');
  });

  it('returns the requested number of recent months, oldest first', () => {
    const keys = recentMonthKeys(3, new Date(2026, 10, 15));
    expect(keys).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('filters transactions to a month', () => {
    const rows = [
      tx({ date: '2026-11-03' }),
      tx({ date: '2026-10-28' }),
      tx({ date: '2026-11-30' }),
    ];
    expect(inMonth(rows, '2026-11')).toHaveLength(2);
  });

  it('groups by category, largest first', () => {
    const grouped = groupByCategory([
      tx({ category: 'Food', amount: 100 }),
      tx({ category: 'Rent', amount: 900 }),
      tx({ category: 'Food', amount: 200 }),
    ]);
    expect(grouped[0]).toEqual({ category: 'Rent', total: 900 });
    expect(grouped[1]).toEqual({ category: 'Food', total: 300 });
  });

  it('computes percentage change, including from a negative baseline', () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(100, 50)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(0, 10)).toBe(100);
    expect(percentChange(-100, -50)).toBe(50);
  });

  it('never reports a negative number of months remaining', () => {
    const past = new Date(Date.now() - 90 * 86400000).toISOString();
    expect(monthsUntil(past)).toBe(0);
  });

  it('computes the monthly saving needed to reach a goal', () => {
    const inTwelveMonths = new Date();
    inTwelveMonths.setMonth(inTwelveMonths.getMonth() + 12);
    const needed = monthlySavingNeeded(
      120000,
      0,
      inTwelveMonths.toISOString().slice(0, 10)
    );
    expect(needed).toBeGreaterThan(9000);
    expect(needed).toBeLessThan(11000);
  });

  it('needs nothing further once a goal is funded', () => {
    expect(monthlySavingNeeded(1000, 1000, '2027-01-01')).toBe(0);
  });

  it('asks for the whole remainder when the deadline is inside a month', () => {
    const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    expect(monthlySavingNeeded(5000, 1000, soon)).toBe(4000);
  });
});
