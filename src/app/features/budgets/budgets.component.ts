import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BudgetProgress, BudgetService } from '../../core/services/budget.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { CurrencyService } from '../../core/services/currency.service';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { categoryIcon } from '../../shared/utils/category-icons';
import { monthKey, monthLabel, recentMonthKeys } from '../../shared/utils/finance.utils';
import {
  BudgetDialogComponent,
  BudgetDialogResult,
} from './budget-dialog.component';

/**
 * Budget management — Section 3.4.
 * Per-category monthly limits with progress bars, 80%/100% alerts, a
 * budget-versus-actual chart and a "copy last month" action.
 */
@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    ChartCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly budgets = inject(BudgetService);

  protected readonly month = signal(monthKey());
  protected readonly loading = computed(() => !this.budgets.loaded());

  /** Months offered in the picker: the last 12, plus any month with data. */
  protected readonly monthOptions = computed(() => {
    const keys = new Set([...recentMonthKeys(12), ...this.budgets.months()]);
    return [...keys].sort().reverse().map(key => ({ key, label: monthLabel(key) }));
  });

  protected readonly progress = computed(() =>
    this.budgets.progressFor(this.month())
  );

  protected readonly totals = computed(() => {
    const rows = this.progress();
    const limit = rows.reduce((sum, r) => sum + r.budget.limit, 0);
    const spent = rows.reduce((sum, r) => sum + r.spent, 0);
    return {
      limit,
      spent,
      remaining: limit - spent,
      usage: limit > 0 ? (spent / limit) * 100 : 0,
      overCount: rows.filter(r => r.status === 'red').length,
      nearCount: rows.filter(r => r.status === 'amber').length,
    };
  });

  protected readonly previousMonthKey = computed(() =>
    this.budgets.previousMonth(this.month())
  );

  protected readonly canCopyPrevious = computed(
    () =>
      this.budgets.items().some(b => b.month === this.previousMonthKey()) &&
      this.progress().length < 8
  );

  protected readonly monthName = computed(() => monthLabel(this.month()));

  // ─────────────────────────────── Chart ───────────────────────────────

  protected readonly chartData = computed<ChartData<'bar'>>(() => {
    const rows = this.progress();
    return {
      labels: rows.map(r => r.budget.category),
      datasets: [
        {
          label: 'Budget',
          data: rows.map(r => r.budget.limit),
          backgroundColor: this.charts.withAlpha('#4F46E5', 0.28),
          borderRadius: 6,
          maxBarThickness: 26,
        },
        {
          label: 'Spent',
          data: rows.map(r => Math.round(r.spent)),
          backgroundColor: rows.map(r =>
            r.status === 'red'
              ? '#DC2626'
              : r.status === 'amber'
                ? '#D97706'
                : '#16A34A'
          ),
          borderRadius: 6,
          maxBarThickness: 26,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'bar'>(
        context =>
          `${context.dataset.label}: ${this.currency.format(
            Number(context.parsed.x)
          )}`
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

  // ─────────────────────────────── Actions ───────────────────────────────

  protected add(): void {
    this.openDialog();
  }

  protected edit(row: BudgetProgress): void {
    this.openDialog(row);
  }

  private openDialog(row?: BudgetProgress): void {
    this.dialog
      .open(BudgetDialogComponent, {
        width: '420px',
        data: {
          month: this.month(),
          category: row?.budget.category,
          limit: row?.budget.limit,
          taken: this.progress().map(p => p.budget.category),
        },
      })
      .afterClosed()
      .subscribe((result: BudgetDialogResult | undefined) => {
        if (!result) return;
        this.budgets
          .setLimit(result.category, this.month(), result.limit)
          .subscribe(() => {
            this.toast.success(
              row
                ? `${result.category} limit updated.`
                : `Budget added for ${result.category}.`
            );
            this.notifications.refreshAlerts().subscribe();
          });
      });
  }

  protected remove(row: BudgetProgress): void {
    confirmAction(this.dialog, {
      title: `Remove the ${row.budget.category} budget?`,
      message: `Spending in ${row.budget.category} will no longer be tracked against a limit for ${this.monthName()}.`,
      confirmLabel: 'Remove budget',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.budgets.remove(row.budget.id).subscribe(() => {
        this.toast.success('Budget removed.');
      });
    });
  }

  protected copyPrevious(): void {
    const from = this.previousMonthKey();
    this.budgets.copyMonth(from, this.month()).subscribe(count => {
      this.toast.success(
        count === 0
          ? `Nothing to copy — every category from ${monthLabel(from)} already has a budget.`
          : `Copied ${count} budget${count === 1 ? '' : 's'} from ${monthLabel(from)}.`
      );
    });
  }

  // ───────────────────────────── Presentation ─────────────────────────────

  protected iconFor(category: string): string {
    return categoryIcon(category);
  }

  protected colourFor(category: string): string {
    return this.charts.categoryColour(category);
  }

  protected statusLabel(row: BudgetProgress): string {
    if (row.status === 'red') return 'Over budget';
    if (row.status === 'amber') return 'Near the limit';
    return 'On track';
  }
}
