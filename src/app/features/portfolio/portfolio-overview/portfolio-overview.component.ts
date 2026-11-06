import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AssetType } from '../../../core/models/holding.model';
import {
  ASSET_TYPE_ICONS,
  ASSET_TYPE_LABELS,
  HoldingMetrics,
  PortfolioService,
} from '../../../core/services/portfolio.service';
import { MarketDataService } from '../../../core/services/market-data.service';
import { ExportService } from '../../../core/services/export.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CountUpDirective } from '../../../shared/directives/count-up.directive';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PercentChangePipe } from '../../../shared/pipes/percent-change.pipe';
import {
  HoldingDialogComponent,
  HoldingDialogResult,
} from '../holding-dialog.component';

type Range = '1W' | '1M' | '6M' | '1Y' | 'All';

/**
 * Portfolio overview — Section 3.6.
 * Live-priced summary, allocation donut, performance line with range tabs,
 * gainers and losers, holdings table, and rebalancing suggestions.
 */
@Component({
  selector: 'app-portfolio-overview',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    ChartCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    CountUpDirective,
    MoneyPipe,
    PercentChangePipe,
  ],
  templateUrl: './portfolio-overview.component.html',
  styleUrl: './portfolio-overview.component.scss',
})
export class PortfolioOverviewComponent {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly exports = inject(ExportService);
  private readonly toast = inject(NotificationService);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly portfolio = inject(PortfolioService);
  protected readonly market = inject(MarketDataService);

  protected readonly labels = ASSET_TYPE_LABELS;
  protected readonly icons = ASSET_TYPE_ICONS;
  protected readonly ranges: Range[] = ['1W', '1M', '6M', '1Y', 'All'];
  protected readonly range = signal<Range>('6M');

  protected readonly loading = computed(() => !this.portfolio.loaded());
  protected readonly metrics = computed(() => this.portfolio.metrics());

  protected readonly summary = computed(() => ({
    invested: this.portfolio.totalInvested(),
    current: this.portfolio.totalCurrent(),
    pl: this.portfolio.totalPl(),
    plPercent: this.portfolio.totalPlPercent(),
    dayChange: this.portfolio.dayChange(),
    xirr: this.portfolio.xirr(),
    cagr: this.portfolio.cagr(),
  }));

  // ───────────────────────────── Allocation ─────────────────────────────

  protected readonly allocationData = computed<ChartData<'doughnut'>>(() => {
    const rows = this.portfolio.allocation();
    return {
      labels: rows.map(r => ASSET_TYPE_LABELS[r.type]),
      datasets: [
        {
          data: rows.map(r => Math.round(r.value)),
          backgroundColor: this.charts.palette(rows.length),
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    };
  });

  protected readonly allocationOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
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

  // ───────────────────────────── Performance ─────────────────────────────

  protected readonly performanceData = computed<ChartData<'line'>>(() => {
    const series = this.portfolio.performanceSeries(this.range());
    const gaining = this.summary().pl >= 0;
    const colour = gaining ? '#16A34A' : '#DC2626';
    return {
      labels: series.labels,
      datasets: [
        {
          label: 'Portfolio value',
          data: series.values,
          borderColor: colour,
          borderWidth: 2.5,
          fill: true,
          backgroundColor: context => this.charts.gradientFill(context, colour, 0.26),
          pointBackgroundColor: colour,
        },
      ],
    };
  });

  protected readonly performanceOptions = computed<ChartOptions<'line'>>(() => ({
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

  // ───────────────────────────── Actions ─────────────────────────────

  protected setRange(range: Range): void {
    this.range.set(range);
  }

  protected addHolding(): void {
    this.dialog
      .open(HoldingDialogComponent, { width: '600px', data: {} })
      .afterClosed()
      .subscribe((result: HoldingDialogResult | undefined) => {
        if (!result) return;
        const { fees, ...holding } = result;
        this.portfolio.buyNew(holding, fees).subscribe(created => {
          this.toast.success(`${created.symbol} added to your portfolio.`);
        });
      });
  }

  protected open(row: HoldingMetrics): void {
    void this.router.navigate(['/portfolio', row.holding.id]);
  }

  protected exportCsv(): void {
    if (this.metrics().length === 0) {
      this.toast.info('There are no holdings to export.');
      return;
    }
    this.exports.portfolioCsv(this.metrics());
    this.toast.success('Portfolio exported to CSV.');
  }

  protected exportPdf(): void {
    if (this.metrics().length === 0) {
      this.toast.info('There are no holdings to export.');
      return;
    }
    const s = this.summary();
    this.exports.portfolioStatementPdf(this.metrics(), {
      invested: s.invested,
      current: s.current,
      pl: s.pl,
      plPercent: s.plPercent,
      xirr: s.xirr,
    });
  }

  // ─────────────────────────── Presentation ───────────────────────────

  /** `tick-up` / `tick-down` flash class for the latest price move. */
  protected tickClass(symbol: string): string {
    const direction = this.market.direction(symbol);
    if (direction === 'up') return 'tick-up';
    if (direction === 'down') return 'tick-down';
    return '';
  }

  protected typeLabel(type: AssetType): string {
    return ASSET_TYPE_LABELS[type];
  }

  protected rebalanceLabel(delta: number): string {
    return delta > 0 ? 'Buy' : 'Sell';
  }
}
