import { Injectable, computed, inject } from '@angular/core';
import { TransactionService } from './transaction.service';
import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { PortfolioService } from './portfolio.service';
import {
  HealthScoreBreakdown,
  groupByCategory,
  healthScore,
  inMonth,
  monthKey,
  monthLabel,
  percentChange,
  recentMonthKeys,
  savingsRate,
  totalExpense,
  totalIncome,
} from '../../shared/utils/finance.utils';

/** One monthly data point for the comparison charts. */
export interface MonthlySummary {
  key: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
  savingsRatePercent: number;
}

/** A generated plain-language observation shown on the analytics page. */
export interface Insight {
  icon: string;
  tone: 'success' | 'danger' | 'warning' | 'primary';
  text: string;
}

/**
 * Derived analytics: monthly comparisons, spending trends, generated insights
 * and the financial health score.
 *
 * Everything is computed from the other stores, so this service holds no state
 * of its own.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly transactions = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly goals = inject(GoalService);
  private readonly portfolio = inject(PortfolioService);

  /** Last 12 months of cash flow, oldest first. */
  readonly monthlySeries = computed<MonthlySummary[]>(() =>
    this.seriesFor(12)
  );

  /** Last 6 months — the dashboard's shorter window. */
  readonly recentSeries = computed<MonthlySummary[]>(() => this.seriesFor(6));

  readonly currentMonth = computed<MonthlySummary>(() => {
    const series = this.monthlySeries();
    return (
      series[series.length - 1] ?? {
        key: monthKey(),
        label: monthLabel(monthKey()),
        income: 0,
        expense: 0,
        savings: 0,
        savingsRatePercent: 0,
      }
    );
  });

  readonly previousMonth = computed<MonthlySummary | null>(() => {
    const series = this.monthlySeries();
    return series.length >= 2 ? series[series.length - 2] : null;
  });

  /** Month-over-month change in income, expense and savings. */
  readonly monthOverMonth = computed(() => {
    const current = this.currentMonth();
    const previous = this.previousMonth();
    if (!previous) return { income: 0, expense: 0, savings: 0 };
    return {
      income: percentChange(previous.income, current.income),
      expense: percentChange(previous.expense, current.expense),
      savings: percentChange(previous.savings, current.savings),
    };
  });

  /** Average monthly expense over the months that have any activity. */
  readonly averageMonthlyExpense = computed(() => {
    const active = this.monthlySeries().filter(m => m.expense > 0);
    if (active.length === 0) return 0;
    return active.reduce((sum, m) => sum + m.expense, 0) / active.length;
  });

  /** Top spending categories this month. */
  readonly topCategories = computed(() =>
    groupByCategory(
      this.transactions.thisMonth().filter(t => t.type === 'expense')
    ).slice(0, 6)
  );

  /** Year-to-date and full-year totals, by calendar year. */
  readonly yearlySeries = computed(() => {
    const byYear = new Map<number, { income: number; expense: number }>();
    for (const t of this.transactions.items()) {
      const year = new Date(t.date).getFullYear();
      const bucket = byYear.get(year) ?? { income: 0, expense: 0 };
      if (t.type === 'income') bucket.income += t.amount;
      else bucket.expense += t.amount;
      byYear.set(year, bucket);
    }
    return [...byYear.entries()]
      .map(([year, totals]) => ({
        year,
        ...totals,
        savings: totals.income - totals.expense,
      }))
      .sort((a, b) => a.year - b.year);
  });

  /** Months of expenses covered by the emergency-fund goal. */
  readonly emergencyFundMonths = computed(() =>
    this.goals.emergencyFundMonths(this.averageMonthlyExpense())
  );

  /** Financial health score with its weighted components. */
  readonly health = computed<HealthScoreBreakdown>(() =>
    healthScore({
      savingsRatePercent: this.currentMonth().savingsRatePercent,
      budgetAdherence: this.budgets.adherence(),
      diversification: this.portfolio.diversification(),
      emergencyFundMonths: this.emergencyFundMonths(),
    })
  );

  /**
   * Plain-language observations. Each one states a mechanism and a number, and
   * only appears when the underlying data supports it.
   */
  readonly insights = computed<Insight[]>(() => {
    const out: Insight[] = [];
    const current = this.currentMonth();
    const previous = this.previousMonth();

    if (previous && previous.expense > 0) {
      const change = percentChange(previous.expense, current.expense);
      if (Math.abs(change) >= 5) {
        out.push({
          icon: change > 0 ? 'trending_up' : 'trending_down',
          tone: change > 0 ? 'danger' : 'success',
          text: `You spent ${Math.abs(change).toFixed(0)}% ${
            change > 0 ? 'more' : 'less'
          } in ${current.label} than in ${previous.label}.`,
        });
      }
    }

    // Biggest category movement month over month.
    if (previous) {
      const currentByCategory = new Map(
        groupByCategory(
          inMonth(this.transactions.items(), current.key).filter(
            t => t.type === 'expense'
          )
        ).map(c => [c.category, c.total])
      );
      const previousByCategory = new Map(
        groupByCategory(
          inMonth(this.transactions.items(), previous.key).filter(
            t => t.type === 'expense'
          )
        ).map(c => [c.category, c.total])
      );

      let worst: { category: string; change: number } | null = null;
      for (const [category, total] of currentByCategory) {
        const before = previousByCategory.get(category) ?? 0;
        if (before < 500) continue; // ignore noise from tiny baselines
        const change = percentChange(before, total);
        if (!worst || Math.abs(change) > Math.abs(worst.change)) {
          worst = { category, change };
        }
      }
      if (worst && Math.abs(worst.change) >= 15) {
        out.push({
          icon: 'category',
          tone: worst.change > 0 ? 'warning' : 'success',
          text: `${worst.category} is ${Math.abs(worst.change).toFixed(0)}% ${
            worst.change > 0 ? 'higher' : 'lower'
          } than last month.`,
        });
      }
    }

    // Savings rate.
    const rate = current.savingsRatePercent;
    if (current.income > 0) {
      out.push({
        icon: rate >= 20 ? 'savings' : 'priority_high',
        tone: rate >= 20 ? 'success' : rate >= 10 ? 'warning' : 'danger',
        text:
          rate >= 20
            ? `Strong month: you saved ${rate.toFixed(0)}% of your income.`
            : `Your savings rate is ${rate.toFixed(
                0
              )}% — aim for 20% or more of income.`,
      });
    }

    // Budget overruns.
    const over = this.budgets
      .currentMonthProgress()
      .filter(p => p.usage >= 100);
    if (over.length > 0) {
      out.push({
        icon: 'account_balance_wallet',
        tone: 'danger',
        text: `${over.length === 1 ? 'One category has' : `${over.length} categories have`} gone past their budget: ${over
          .map(p => p.budget.category)
          .join(', ')}.`,
      });
    }

    // Emergency fund.
    const months = this.emergencyFundMonths();
    if (this.averageMonthlyExpense() > 0) {
      out.push({
        icon: 'health_and_safety',
        tone: months >= 6 ? 'success' : months >= 3 ? 'warning' : 'danger',
        text:
          months <= 0
            ? 'You have no emergency fund goal yet — three to six months of expenses is the usual target.'
            : `Your emergency fund covers ${months.toFixed(
                1
              )} months of average expenses.`,
      });
    }

    // Portfolio concentration.
    const allocation = this.portfolio.allocation();
    if (allocation.length > 0) {
      const largest = allocation[0];
      if (largest.percent >= 50) {
        out.push({
          icon: 'pie_chart',
          tone: 'warning',
          text: `${largest.percent.toFixed(
            0
          )}% of your portfolio sits in one asset type — consider spreading it wider.`,
        });
      }
    }

    // Portfolio performance.
    if (this.portfolio.totalInvested() > 0) {
      const pl = this.portfolio.totalPlPercent();
      out.push({
        icon: pl >= 0 ? 'trending_up' : 'trending_down',
        tone: pl >= 0 ? 'success' : 'danger',
        text: `Your portfolio is ${pl >= 0 ? 'up' : 'down'} ${Math.abs(
          pl
        ).toFixed(1)}% overall against an invested amount of ₹${Math.round(
          this.portfolio.totalInvested()
        ).toLocaleString('en-IN')}.`,
      });
    }

    return out;
  });

  /** Cash flow for the last `count` months, oldest first. */
  private seriesFor(count: number): MonthlySummary[] {
    const all = this.transactions.items();
    return recentMonthKeys(count).map(key => {
      const rows = inMonth(all, key);
      const income = totalIncome(rows);
      const expense = totalExpense(rows);
      return {
        key,
        label: monthLabel(key),
        income,
        expense,
        savings: income - expense,
        savingsRatePercent: savingsRate(rows),
      };
    });
  }
}
