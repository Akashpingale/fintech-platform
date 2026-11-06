import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { SipProgress, SipService } from '../../core/services/sip.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { CurrencyService } from '../../core/services/currency.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SipDialogComponent, SipDialogResult } from './sip-dialog.component';

/**
 * SIP tracker — Section 3.7.
 * Active plans, instalment progress, next-due reminders and a projection
 * chart of invested amount against expected value.
 */
@Component({
  selector: 'app-sip',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    StatCardComponent,
    ChartCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './sip.component.html',
  styleUrl: './sip.component.scss',
})
export class SipComponent {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly sips = inject(SipService);

  /** Which plan the projection chart is showing. */
  protected readonly selectedId = signal<string | null>(null);

  protected readonly loading = computed(() => !this.sips.loaded());
  protected readonly progress = computed(() => this.sips.progress());

  protected readonly selected = computed<SipProgress | null>(() => {
    const rows = this.progress();
    if (rows.length === 0) return null;
    const id = this.selectedId();
    return rows.find(r => r.sip.id === id) ?? rows[0];
  });

  protected readonly summary = computed(() => {
    const rows = this.progress();
    return {
      monthly: this.sips.monthlyOutflow(),
      invested: this.sips.totalInvested(),
      value: this.sips.totalCurrentValue(),
      active: rows.filter(r => !r.isComplete).length,
      maturity: rows.reduce((sum, r) => sum + r.maturityValue, 0),
    };
  });

  protected readonly gain = computed(
    () => this.summary().value - this.summary().invested
  );

  // ─────────────────────────────── Chart ───────────────────────────────

  protected readonly projectionData = computed<ChartData<'bar'>>(() => {
    const row = this.selected();
    if (!row) return { labels: [], datasets: [] };

    const projection = this.sips.projection(row.sip);
    return {
      labels: projection.labels,
      datasets: [
        {
          label: 'Invested',
          data: projection.invested,
          backgroundColor: this.charts.withAlpha('#4F46E5', 0.45),
          borderRadius: 6,
          stack: 'total',
          maxBarThickness: 32,
        },
        {
          label: 'Expected gain',
          data: projection.value.map((value, index) =>
            Math.max(0, value - projection.invested[index])
          ),
          backgroundColor: '#16A34A',
          borderRadius: 6,
          stack: 'total',
          maxBarThickness: 32,
        },
      ],
    };
  });

  protected readonly projectionOptions = computed<ChartOptions<'bar'>>(() => ({
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
      stacked: true,
      yCallback: value => this.currency.formatCompact(value),
    }),
  }));

  // ─────────────────────────────── Actions ───────────────────────────────

  protected select(row: SipProgress): void {
    this.selectedId.set(row.sip.id);
  }

  protected create(): void {
    this.dialog
      .open(SipDialogComponent, { width: '560px', data: {} })
      .afterClosed()
      .subscribe((result: SipDialogResult | undefined) => {
        if (!result) return;
        this.sips.add(result).subscribe(created => {
          this.toast.success(`SIP in ${created.fundName} created.`);
          this.notifications.refreshAlerts().subscribe();
        });
      });
  }

  protected edit(row: SipProgress): void {
    this.dialog
      .open(SipDialogComponent, { width: '560px', data: { sip: row.sip } })
      .afterClosed()
      .subscribe((result: SipDialogResult | undefined) => {
        if (!result) return;
        this.sips
          .update({ ...row.sip, ...result })
          .subscribe(() => this.toast.success('SIP updated.'));
      });
  }

  protected remove(row: SipProgress): void {
    confirmAction(this.dialog, {
      title: `Stop the ${row.sip.fundName} SIP?`,
      message: `The plan and its ${row.instalmentsPaid} recorded instalment${row.instalmentsPaid === 1 ? '' : 's'} will be removed from tracking.`,
      confirmLabel: 'Stop SIP',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.sips
        .remove(row.sip.id)
        .subscribe(() => this.toast.success('SIP removed.'));
    });
  }

  // ───────────────────────────── Presentation ─────────────────────────────

  protected dueLabel(row: SipProgress): string {
    if (row.isComplete) return 'Plan complete';
    if (row.daysUntilDue <= 0) return 'Due today';
    if (row.daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${row.daysUntilDue} days`;
  }

  protected completionPercent(row: SipProgress): number {
    if (row.sip.durationMonths === 0) return 0;
    return (row.instalmentsPaid / row.sip.durationMonths) * 100;
  }

  protected isSelected(row: SipProgress): boolean {
    return this.selected()?.sip.id === row.sip.id;
  }
}
