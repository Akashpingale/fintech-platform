/**
 * Pure financial business logic — Section 7 of the implementation plan.
 *
 * Every function here is side-effect free and independently unit-testable.
 * Services and components must not re-implement these formulas inline.
 */

import { AssetType, Holding } from '../../core/models/holding.model';
import { Transaction } from '../../core/models/transaction.model';

// ───────────────────────────── Cash flow ─────────────────────────────

/** Sum of all income transactions. */
export function totalIncome(transactions: readonly Transaction[]): number {
  return transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Sum of all expense transactions. */
export function totalExpense(transactions: readonly Transaction[]): number {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Income − expense. */
export function netSavings(transactions: readonly Transaction[]): number {
  return totalIncome(transactions) - totalExpense(transactions);
}

/** (Income − Expense) / Income × 100. Returns 0 when there is no income. */
export function savingsRate(transactions: readonly Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 0;
  return ((income - totalExpense(transactions)) / income) * 100;
}

/**
 * Net worth = cash balance + portfolio value + amount saved into goals.
 * Liabilities are not modelled in this app, so they are passed in explicitly
 * (default 0) rather than silently assumed away.
 */
export function netWorth(
  cashBalance: number,
  portfolioValue: number,
  goalsSaved: number,
  liabilities = 0
): number {
  return cashBalance + portfolioValue + goalsSaved - liabilities;
}

// ───────────────────────────── Portfolio ─────────────────────────────

/** Amount originally invested in a holding. */
export function investedValue(holding: Holding): number {
  return holding.avgBuyPrice * holding.quantity;
}

/** Market value of a holding at its current price. */
export function currentValue(holding: Holding): number {
  return holding.currentPrice * holding.quantity;
}

/** (Current price − Avg buy price) × Quantity. */
export function profitLoss(holding: Holding): number {
  return currentValue(holding) - investedValue(holding);
}

/** P/L as a percentage of the invested amount. */
export function returnPercent(invested: number, current: number): number {
  if (invested <= 0) return 0;
  return ((current - invested) / invested) * 100;
}

/**
 * Compound annual growth rate as a percentage.
 * Returns 0 for non-positive inputs or a zero-length period.
 */
export function cagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/** A dated cash flow: negative for money paid in, positive for money received. */
export interface CashFlow {
  amount: number;
  date: Date;
}

/**
 * Extended internal rate of return, as an annual percentage.
 *
 * Solved with bisection over -99%..+1000% because it is robust for the
 * irregular, sign-mixed cash flows a portfolio produces (Newton's method can
 * diverge there). Returns 0 when the flows have no sign change, since no rate
 * can make them net to zero.
 */
export function xirr(flows: readonly CashFlow[], guessRange = 10): number {
  if (flows.length < 2) return 0;

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const hasInflow = sorted.some(f => f.amount > 0);
  const hasOutflow = sorted.some(f => f.amount < 0);
  if (!hasInflow || !hasOutflow) return 0;

  const start = sorted[0].date.getTime();
  const yearsFrom = (d: Date) => (d.getTime() - start) / (365 * 24 * 3600 * 1000);

  const npv = (rate: number): number =>
    sorted.reduce(
      (acc, f) => acc + f.amount / Math.pow(1 + rate, yearsFrom(f.date)),
      0
    );

  let low = -0.9999;
  let high = guessRange;
  if (npv(low) * npv(high) > 0) return 0; // no root in range

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < 1e-7) return mid * 100;
    if (npv(low) * value < 0) high = mid;
    else low = mid;
  }
  return ((low + high) / 2) * 100;
}

/** Share of portfolio value held in each asset type, as percentages. */
export function allocationByAssetType(
  holdings: readonly Holding[]
): { type: AssetType; value: number; percent: number }[] {
  const total = holdings.reduce((sum, h) => sum + currentValue(h), 0);
  const buckets = new Map<AssetType, number>();
  for (const h of holdings) {
    buckets.set(h.assetType, (buckets.get(h.assetType) ?? 0) + currentValue(h));
  }
  return [...buckets.entries()]
    .map(([type, value]) => ({
      type,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Diversification score 0–100 from the Herfindahl–Hirschman index of the
 * allocation: one concentrated holding scores near 0, an evenly spread
 * portfolio across many asset types scores near 100.
 */
export function diversificationScore(holdings: readonly Holding[]): number {
  const allocation = allocationByAssetType(holdings);
  if (allocation.length === 0) return 0;
  if (allocation.length === 1) return 0;

  const hhi = allocation.reduce((sum, a) => sum + Math.pow(a.percent / 100, 2), 0);
  const n = allocation.length;
  const minHhi = 1 / n; // perfectly even split across the types held
  const normalised = (1 - hhi) / (1 - minHhi); // 0..1 evenness within those types
  // Reward breadth too: 6 asset types is treated as full breadth.
  const breadth = Math.min(1, n / 6);
  return Math.round(Math.max(0, Math.min(1, normalised * 0.5 + breadth * 0.5)) * 100);
}

/** A target allocation the user wants to hold, keyed by asset type. */
export type TargetAllocation = Partial<Record<AssetType, number>>;

export interface RebalanceAction {
  type: AssetType;
  currentPercent: number;
  targetPercent: number;
  /** Positive = buy this much more, negative = sell this much. */
  deltaAmount: number;
}

/** Suggests buy/sell amounts to move the portfolio toward a target mix. */
export function rebalanceSuggestions(
  holdings: readonly Holding[],
  target: TargetAllocation
): RebalanceAction[] {
  const total = holdings.reduce((sum, h) => sum + currentValue(h), 0);
  if (total <= 0) return [];

  const current = new Map(
    allocationByAssetType(holdings).map(a => [a.type, a.percent])
  );
  const types = new Set<AssetType>([
    ...current.keys(),
    ...(Object.keys(target) as AssetType[]),
  ]);

  return [...types]
    .map(type => {
      const currentPercent = current.get(type) ?? 0;
      const targetPercent = target[type] ?? 0;
      return {
        type,
        currentPercent,
        targetPercent,
        deltaAmount: ((targetPercent - currentPercent) / 100) * total,
      };
    })
    .filter(a => Math.abs(a.targetPercent - a.currentPercent) >= 1)
    .sort((a, b) => b.deltaAmount - a.deltaAmount);
}

// ───────────────────────────── Budgets ─────────────────────────────

/** Spent/limit ratio as a percentage (uncapped, so overspend shows > 100). */
export function budgetUsage(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return (spent / limit) * 100;
}

/**
 * Budget adherence 0–100 across every budget: a category at or under its
 * limit contributes 100, one at double its limit contributes 0.
 */
export function budgetAdherence(
  budgets: readonly { spent: number; limit: number }[]
): number {
  if (budgets.length === 0) return 50; // neutral when nothing is budgeted
  const scores = budgets.map(b => {
    const usage = budgetUsage(b.spent, b.limit);
    if (usage <= 100) return 100;
    return Math.max(0, 100 - (usage - 100));
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ───────────────────────────── Health score ─────────────────────────────

export interface HealthScoreInput {
  /** Savings rate as a percentage. */
  savingsRatePercent: number;
  /** Budget adherence 0–100. */
  budgetAdherence: number;
  /** Diversification 0–100. */
  diversification: number;
  /** Liquid savings expressed in months of expenses covered. */
  emergencyFundMonths: number;
}

export interface HealthScoreBreakdown {
  score: number;
  components: { label: string; weight: number; score: number }[];
  band: 'poor' | 'fair' | 'good' | 'excellent';
}

/**
 * Financial health score 0–100.
 * Weights (Section 7): savings rate 30%, budget adherence 25%,
 * diversification 25%, emergency fund 20%.
 */
export function healthScore(input: HealthScoreInput): HealthScoreBreakdown {
  // A 30% savings rate is treated as full marks.
  const savings = clamp01(input.savingsRatePercent / 30) * 100;
  const adherence = clamp01(input.budgetAdherence / 100) * 100;
  const diversification = clamp01(input.diversification / 100) * 100;
  // Six months of expenses is treated as a complete emergency fund.
  const emergency = clamp01(input.emergencyFundMonths / 6) * 100;

  const components = [
    { label: 'Savings rate', weight: 30, score: Math.round(savings) },
    { label: 'Budget adherence', weight: 25, score: Math.round(adherence) },
    { label: 'Diversification', weight: 25, score: Math.round(diversification) },
    { label: 'Emergency fund', weight: 20, score: Math.round(emergency) },
  ];

  const score = Math.round(
    components.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
  );

  return { score, components, band: scoreBand(score) };
}

function scoreBand(score: number): HealthScoreBreakdown['band'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// ───────────────────────────── Dates & grouping ─────────────────────────────

/** `YYYY-MM` key for a date or ISO string. */
export function monthKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human month label, e.g. `Nov 2026`. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, (month ?? 1) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** The last `count` month keys, oldest first, ending with the current month. */
export function recentMonthKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  }
  return keys;
}

/** Transactions that fall in the given `YYYY-MM` month. */
export function inMonth(
  transactions: readonly Transaction[],
  key: string
): Transaction[] {
  return transactions.filter(t => monthKey(t.date) === key);
}

/** Totals per category, largest first. */
export function groupByCategory(
  transactions: readonly Transaction[]
): { category: string; total: number }[] {
  const buckets = new Map<string, number>();
  for (const t of transactions) {
    buckets.set(t.category, (buckets.get(t.category) ?? 0) + t.amount);
  }
  return [...buckets.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Percentage change from `previous` to `current`. */
export function percentChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Whole months remaining until a deadline (never negative). */
export function monthsUntil(deadline: string | Date): number {
  const end = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const days = (end.getTime() - Date.now()) / (24 * 3600 * 1000);
  return Math.max(0, days / 30.44);
}

/** Monthly contribution needed to reach a goal by its deadline. */
export function monthlySavingNeeded(
  targetAmount: number,
  savedAmount: number,
  deadline: string
): number {
  const remaining = Math.max(0, targetAmount - savedAmount);
  const months = monthsUntil(deadline);
  if (remaining === 0) return 0;
  return months < 1 ? remaining : remaining / months;
}
