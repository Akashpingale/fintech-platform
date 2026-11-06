import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TransactionService } from '../../core/services/transaction.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { CurrencyService } from '../../core/services/currency.service';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { HealthGaugeComponent } from '../../shared/components/health-gauge/health-gauge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { categoryIcon } from '../../shared/utils/category-icons';

type View = 'monthly' | 'yearly';

/**
 * Analytics and insights — Section 3.9.
 * Monthly and yearly comparisons, savings-rate trend, top categories,
 * generated insights and the financial health score.
 */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    ChartCardComponent,
    HealthGaugeComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent {
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);
  private readonly transactions = inject(TransactionService);

  protected readonly analytics = inject(AnalyticsService);

  protected readonly view = signal<View>('monthly');
  protected readonly loading = computed(() => !this.transactions.loaded());
  protected readonly hasData = computed(() => this.transactions.items().length > 0);

  protected readonly health = computed(() => this.analytics.health());
  protected readonly insights = computed(() => this.analytics.insights());

  // ───────────────────────── Income vs expense ─────────────────────────

  protected readonly comparisonData = computed<ChartData<'bar'>>(() => {
    if (this.view() === 'yearly') {
      const years = this.analytics.yearlySeries();
      return {
        labels: years.map(y => String(y.year)),
        datasets: [
          {
            label: 'Income',
            data: years.map(y => Math.round(y.income)),
            backgroundColor: this.charts.withAlpha('#16A34A', 0.85),
            borderRadius: 8,
            maxBarThickness: 48,
          },
          {
            label: 'Expense',
            data: years.map(y => Math.round(y.expense)),
            backgroundColor: this.charts.withAlpha('#DC2626', 0.8),
            borderRadius: 8,
            maxBarThickness: 48,
          },
        ],
      };
    }

    const months = this.analytics.monthlySeries();
    return {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Income',
          data: months.map(m => Math.round(m.income)),
          backgroundColor: this.charts.withAlpha('#16A34A', 0.85),
          borderRadius: 6,
          maxBarThickness: 22,
        },
        {
          label: 'Expense',
          data: months.map(m => Math.round(m.expense)),
          backgroundColor: this.charts.withAlpha('#DC2626', 0.8),
          borderRadius: 6,
          maxBarThickness: 22,
        },
      ],
    };
  });

  protected readonly comparisonOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'bar'>(
        context =>
          `${context.dataset.label}: ${this.currency.format(
            Number(context.parsed.y)
          )}`
      ),
    },
    scales: this.charts.scales({
      yCallback: value => this.currency.formatCompact(value),
    }),
  }));

  // ───────────────────────── Savings rate trend ─────────────────────────

  protected readonly savingsRateData = computed<ChartData<'line'>>(() => {
    const months = this.analytics.monthlySeries();
    return {
      labels: months.map(m => m.label.split(' ')[0]),
      datasets: [
        {
          label: 'Savings rate',
          data: months.map(m => Number(m.savingsRatePercent.toFixed(1))),
          borderColor: this.charts.tokens().primary,
          borderWidth: 2.5,
          fill: true,
          backgroundColor: context =>
            this.charts.gradientFill(context, '#4F46E5', 0.24),
          pointBackgroundColor: this.charts.tokens().primary,
        },
      ],
    };
  });

  protected readonly savingsRateOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(false),
      tooltip: this.charts.tooltip<'line'>(
        context => `${Number(context.parsed.y).toFixed(1)}% of income saved`
      ),
    },
    scales: this.charts.scales({
      yCallback: value => `${value}%`,
      beginAtZero: false,
    }),
  }));

  // ───────────────────────── Spending trend ─────────────────────────

  protected readonly categoryTrendData = computed<ChartData<'bar'>>(() => {
    const rows = this.analytics.topCategories();
    return {
      labels: rows.map(r => r.category),
      datasets: [
        {
          label: 'Spent this month',
          data: rows.map(r => Math.round(r.total)),
          backgroundColor: rows.map((r, i) =>
            this.charts.categoryColour(r.category, i)
          ),
          borderRadius: 6,
          maxBarThickness: 26,
        },
      ],
    };
  });

  protected readonly categoryTrendOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: this.charts.legend(false),
      tooltip: this.charts.tooltip<'bar'>(context =>
        this.currency.format(Number(context.parsed.x))
      ),
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: this.charts.tokens().border },
        border: { display: false },
        ticks: {
          color: this.charts.tokens().textMuted,
          callback: (value: string | number) =>
            this.currency.formatCompact(Number(value)),
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: this.charts.tokens().textMuted },
      },
    },
  }));

  // ───────────────────────────── Actions ─────────────────────────────

  protected setView(view: View): void {
    this.view.set(view);
  }

  protected iconFor(category: string): string {
    return categoryIcon(category);
  }

  protected colourFor(category: string, index = 0): string {
    return this.charts.categoryColour(category, index);
  }

  /** Share of this month's expenses taken by a category. */
  protected shareOf(total: number): number {
    const monthExpense = this.analytics.currentMonth().expense;
    return monthExpense > 0 ? (total / monthExpense) * 100 : 0;
  }
}
