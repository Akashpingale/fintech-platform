import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { GoalService } from '../../core/services/goal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AppDataService } from '../../core/services/app-data.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring/progress-ring.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { MoneyCompactPipe, MoneyPipe } from '../../shared/pipes/money.pipe';
import { CATEGORY_ICONS } from '../../shared/utils/category-icons';
import { DecimalPipe } from '@angular/common';

/**
 * Dashboard — Section 3.2.
 * Net-worth hero, four summary cards, cash-flow and category charts, net-worth
 * trend, budget alerts, goal rings and the most recent transactions.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatTooltipModule,
    StatCardComponent,
    ChartCardComponent,
    ProgressRingComponent,
    EmptyStateComponent,
    SkeletonComponent,
    CountUpDirective,
    MoneyPipe,
    MoneyCompactPipe,
    DecimalPipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly transactions = inject(TransactionService);
  protected readonly budgets = inject(BudgetService);
  protected readonly goals = inject(GoalService);
  protected readonly portfolio = inject(PortfolioService);
  protected readonly analytics = inject(AnalyticsService);
  protected readonly appData = inject(AppDataService);
  protected readonly auth = inject(AuthService);

  protected readonly loading = computed(() => !this.transactions.loaded());

  protected readonly firstName = computed(
    () => this.auth.currentUser()?.name.split(' ')[0] ?? 'there'
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  /** Five most recent transactions. */
  protected readonly recent = computed(() =>
    this.transactions.sorted().slice(0, 6)
  );

  /** Up to three goals to show as rings. */
  protected readonly goalRings = computed(() => this.goals.progress().slice(0, 3));

  /** Budget categories at or past 80% usage. */
  protected readonly budgetAlerts = computed(() => this.budgets.alerts().slice(0, 4));

  // ─────────────────────────────── Charts ───────────────────────────────

  /** Income versus expense, last six months. */
  protected readonly cashFlowData = computed<ChartData<'bar'>>(() => {
    const series = this.analytics.recentSeries();
    return {
      labels: series.map(m => m.label.split(' ')[0]),
      datasets: [
        {
          label: 'Income',
          data: series.map(m => Math.round(m.income)),
          backgroundColor: this.charts.withAlpha('#16A34A', 0.85),
          hoverBackgroundColor: '#16A34A',
          borderRadius: 8,
          maxBarThickness: 28,
        },
        {
          label: 'Expense',
          data: series.map(m => Math.round(m.expense)),
          backgroundColor: this.charts.withAlpha('#DC2626', 0.8),
          hoverBackgroundColor: '#DC2626',
          borderRadius: 8,
          maxBarThickness: 28,
        },
      ],
    };
  });

  protected readonly cashFlowOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: this.charts.scales({
      yCallback: value => this.currency.formatCompact(value),
    }),
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'bar'>(
        context =>
          `${context.dataset.label}: ${this.currency.format(
            Number(context.parsed.y)
          )}`
      ),
    },
  }));

  /** Expense split by category for the current month. */
  protected readonly categoryData = computed<ChartData<'doughnut'>>(() => {
    const rows = this.transactions.expenseByCategory();
    return {
      labels: rows.map(r => r.category),
      datasets: [
        {
          data: rows.map(r => Math.round(r.total)),
          backgroundColor: rows.map((r, i) => this.charts.categoryColour(r.category, i)),
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    };
  });

  protected readonly doughnutOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'doughnut'>(context => {
        const total = context.dataset.data.reduce(
          (sum: number, value) => sum + Number(value ?? 0),
          0
        );
        const value = Number(context.parsed);
        const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
        return `${context.label}: ${this.currency.format(value)} (${share}%)`;
      }),
    },
  }));

  /**
   * Net-worth trend: cumulative savings from the cash-flow history plus the
   * current portfolio value and goal savings held flat across the window.
   * The portfolio has no historical valuations in the mock data, so only the
   * cash component varies month to month.
   */
  protected readonly netWorthData = computed<ChartData<'line'>>(() => {
    const series = this.analytics.monthlySeries();
    const base = this.portfolio.totalCurrent() + this.goals.totalSaved();
    let running = 0;
    const values = series.map(m => {
      running += m.savings;
      return Math.round(base + running);
    });

    return {
      labels: series.map(m => m.label),
      datasets: [
        {
          label: 'Net worth',
          data: values,
          borderColor: this.charts.tokens().primary,
          borderWidth: 2.5,
          fill: true,
          backgroundColor: context =>
            this.charts.gradientFill(context, '#4F46E5', 0.28),
          pointBackgroundColor: this.charts.tokens().primary,
        },
      ],
    };
  });

  protected readonly netWorthOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(false),
      tooltip: this.charts.tooltip<'line'>(context =>
        this.currency.format(Number(context.parsed.y))
      ),
    },
    scales: this.charts.scales({
      yCallback: value => this.currency.formatCompact(value),
      beginAtZero: false,
    }),
  }));

  /** Colour for a category avatar. */
  protected colourFor(category: string, index = 0): string {
    return this.charts.categoryColour(category, index);
  }

  protected iconFor(category: string): string {
    return CATEGORY_ICONS[category] ?? 'receipt_long';
  }
}
