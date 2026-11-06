import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { GoalService } from '../../core/services/goal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { ExportService } from '../../core/services/export.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  inMonth,
  monthLabel,
  recentMonthKeys,
  totalExpense,
  totalIncome,
} from '../../shared/utils/finance.utils';

type Period = { kind: 'month'; key: string } | { kind: 'year'; year: number } | { kind: 'all' };

/**
 * Reports and export — Section 3.10.
 * Monthly/yearly statements as PDF or CSV, plus a portfolio statement and a
 * budgets-and-goals report.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    EmptyStateComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly exports = inject(ExportService);
  private readonly toast = inject(NotificationService);
  private readonly budgets = inject(BudgetService);
  private readonly goals = inject(GoalService);
  private readonly portfolio = inject(PortfolioService);

  protected readonly transactions = inject(TransactionService);

  /** Selection string, e.g. `month:2026-11`, `year:2026`, or `all`. */
  protected readonly selection = signal<string>(`month:${recentMonthKeys(1)[0]}`);

  protected readonly periodOptions = computed(() => {
    const months = recentMonthKeys(12)
      .slice()
      .reverse()
      .map(key => ({ value: `month:${key}`, label: monthLabel(key) }));

    const years = [
      ...new Set(
        this.transactions.items().map(t => new Date(t.date).getFullYear())
      ),
    ]
      .sort((a, b) => b - a)
      .map(year => ({ value: `year:${year}`, label: `Full year ${year}` }));

    return [...months, ...years, { value: 'all', label: 'Everything on record' }];
  });

  private readonly period = computed<Period>(() => {
    const value = this.selection();
    if (value === 'all') return { kind: 'all' };
    const [kind, rest] = value.split(':');
    if (kind === 'year') return { kind: 'year', year: Number(rest) };
    return { kind: 'month', key: rest };
  });

  protected readonly periodLabel = computed(() => {
    const period = this.period();
    if (period.kind === 'all') return 'Everything on record';
    if (period.kind === 'year') return `Full year ${period.year}`;
    return monthLabel(period.key);
  });

  /** Transactions inside the selected period. */
  protected readonly rows = computed(() => {
    const period = this.period();
    const all = this.transactions.sorted();
    if (period.kind === 'all') return all;
    if (period.kind === 'year') {
      return all.filter(t => new Date(t.date).getFullYear() === period.year);
    }
    return inMonth(all, period.key);
  });

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const income = totalIncome(rows);
    const expense = totalExpense(rows);
    return {
      count: rows.length,
      income,
      expense,
      savings: income - expense,
      rate: income > 0 ? ((income - expense) / income) * 100 : 0,
    };
  });

  protected readonly hasRows = computed(() => this.rows().length > 0);
  protected readonly holdings = computed(() => this.portfolio.metrics());

  // ─────────────────────────────── Exports ───────────────────────────────

  protected statementPdf(): void {
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.info('There are no transactions in that period.');
      return;
    }
    const dates = rows.map(t => new Date(t.date).getTime());
    this.exports.transactionStatementPdf(rows, {
      label: this.periodLabel(),
      from: new Date(Math.min(...dates)),
      to: new Date(Math.max(...dates)),
    });
    this.toast.success('Statement PDF generated.');
  }

  protected statementCsv(): void {
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.info('There are no transactions in that period.');
      return;
    }
    this.exports.transactionsCsv(rows);
    this.toast.success(`Exported ${rows.length} transactions.`);
  }

  protected portfolioPdf(): void {
    if (this.holdings().length === 0) {
      this.toast.info('Add a holding first — there is nothing to report.');
      return;
    }
    this.exports.portfolioStatementPdf(this.holdings(), {
      invested: this.portfolio.totalInvested(),
      current: this.portfolio.totalCurrent(),
      pl: this.portfolio.totalPl(),
      plPercent: this.portfolio.totalPlPercent(),
      xirr: this.portfolio.xirr(),
    });
    this.toast.success('Portfolio statement generated.');
  }

  protected portfolioCsv(): void {
    if (this.holdings().length === 0) {
      this.toast.info('Add a holding first — there is nothing to export.');
      return;
    }
    this.exports.portfolioCsv(this.holdings());
    this.toast.success('Portfolio exported to CSV.');
  }

  protected planningPdf(): void {
    const budgets = this.budgets.currentMonthProgress();
    const goals = this.goals.progress();
    if (budgets.length === 0 && goals.length === 0) {
      this.toast.info('Set a budget or a savings goal first.');
      return;
    }
    this.exports.planningPdf(budgets, goals, monthLabel(recentMonthKeys(1)[0]));
    this.toast.success('Budgets and goals report generated.');
  }

  protected budgetsCsv(): void {
    const rows = this.budgets.currentMonthProgress();
    if (rows.length === 0) {
      this.toast.info('No budgets are set for this month.');
      return;
    }
    this.exports.downloadCsv(
      'fintrack-budgets',
      rows.map(r => ({
        Category: r.budget.category,
        Month: r.budget.month,
        Limit: r.budget.limit,
        Spent: Math.round(r.spent),
        Remaining: Math.round(r.remaining),
        'Usage %': r.usage.toFixed(1),
        Status: r.status,
      }))
    );
    this.toast.success('Budgets exported to CSV.');
  }

  protected goalsCsv(): void {
    const rows = this.goals.progress();
    if (rows.length === 0) {
      this.toast.info('No savings goals to export.');
      return;
    }
    this.exports.downloadCsv(
      'fintrack-goals',
      rows.map(r => ({
        Goal: r.goal.name,
        Target: r.goal.targetAmount,
        Saved: r.goal.savedAmount,
        'Progress %': r.percent.toFixed(1),
        'Monthly needed': Math.round(r.monthlyNeeded),
        Deadline: r.goal.deadline,
        Status: r.status,
      }))
    );
    this.toast.success('Goals exported to CSV.');
  }
}
