import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import {
  ASSET_TYPE_ICONS,
  ASSET_TYPE_LABELS,
  PortfolioService,
} from '../../../core/services/portfolio.service';
import { AssetTransactionService } from '../../../core/services/asset-transaction.service';
import { MarketDataService } from '../../../core/services/market-data.service';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { NotificationService } from '../../../core/services/notification.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PercentChangePipe } from '../../../shared/pipes/percent-change.pipe';
import { cagr } from '../../../shared/utils/finance.utils';
import {
  HoldingDialogComponent,
  HoldingDialogResult,
} from '../holding-dialog.component';
import {
  TradeDialogComponent,
  TradeDialogResult,
} from '../trade-dialog.component';

/**
 * Holding detail — per-asset metrics and the complete buy/sell ledger,
 * with buy-more, sell and delete actions.
 */
@Component({
  selector: 'app-holding-detail',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
    PercentChangePipe,
  ],
  templateUrl: './holding-detail.component.html',
  styleUrl: './holding-detail.component.scss',
})
export class HoldingDetailComponent {
  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationService);
  private readonly assetTx = inject(AssetTransactionService);
  private readonly watchlist = inject(WatchlistService);

  protected readonly portfolio = inject(PortfolioService);
  protected readonly market = inject(MarketDataService);

  protected readonly labels = ASSET_TYPE_LABELS;
  protected readonly icons = ASSET_TYPE_ICONS;

  protected readonly loading = computed(() => !this.portfolio.loaded());
  protected readonly metrics = computed(() => this.portfolio.metricsFor(this.id()));

  protected readonly quote = computed(() => {
    const holding = this.metrics()?.holding;
    return holding ? this.market.quote(holding.symbol) : null;
  });

  /** Buy/sell ledger for this holding, oldest first. */
  protected readonly history = computed(() => this.assetTx.forHolding(this.id()));

  protected readonly totalFees = computed(() => this.assetTx.feesFor(this.id()));

  protected readonly holdingPeriod = computed(() => {
    const holding = this.metrics()?.holding;
    if (!holding) return { days: 0, label: '—' };
    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(holding.buyDate).getTime()) / (24 * 3600 * 1000)
      )
    );
    if (days < 31) return { days, label: `${days} days` };
    if (days < 365) {
      const months = Math.round(days / 30.44);
      return { days, label: `${months} month${months === 1 ? '' : 's'}` };
    }
    const years = (days / 365.25).toFixed(1);
    return { days, label: `${years} years` };
  });

  /** Annualised return for this single holding. */
  protected readonly holdingCagr = computed(() => {
    const row = this.metrics();
    if (!row) return 0;
    const years = this.holdingPeriod().days / 365.25;
    if (years < 0.08) return 0; // under a month — annualising would mislead
    return cagr(row.invested, row.current, years);
  });

  protected readonly onWatchlist = computed(() => {
    const symbol = this.metrics()?.holding.symbol;
    return symbol
      ? this.watchlist.items().some(item => item.symbol === symbol)
      : false;
  });

  // ─────────────────────────────── Actions ───────────────────────────────

  protected buyMore(): void {
    const row = this.metrics();
    if (!row) return;

    this.dialog
      .open(TradeDialogComponent, {
        width: '560px',
        data: {
          holding: row.holding,
          side: 'buy',
          marketPrice: row.holding.currentPrice,
        },
      })
      .afterClosed()
      .subscribe((result: TradeDialogResult | undefined) => {
        if (!result) return;
        this.portfolio
          .buyMore(row.holding.id, result.quantity, result.price, result.fees, result.date)
          .subscribe({
            next: updated =>
              this.toast.success(
                `Bought ${result.quantity} ${updated.symbol}. New average cost ₹${updated.avgBuyPrice.toLocaleString('en-IN')}.`
              ),
            error: (error: Error) => this.toast.error(error.message),
          });
      });
  }

  protected sell(): void {
    const row = this.metrics();
    if (!row) return;

    this.dialog
      .open(TradeDialogComponent, {
        width: '560px',
        data: {
          holding: row.holding,
          side: 'sell',
          marketPrice: row.holding.currentPrice,
        },
      })
      .afterClosed()
      .subscribe((result: TradeDialogResult | undefined) => {
        if (!result) return;
        this.portfolio
          .sell(row.holding.id, result.quantity, result.price, result.fees, result.date)
          .subscribe({
            next: ({ realised, closed }) => {
              const verb = realised >= 0 ? 'gain' : 'loss';
              this.toast.success(
                `Sold ${result.quantity} ${row.holding.symbol} — realised ${verb} of ₹${Math.abs(Math.round(realised)).toLocaleString('en-IN')}.`
              );
              if (closed) void this.router.navigate(['/portfolio']);
            },
            error: (error: Error) => this.toast.error(error.message),
          });
      });
  }

  protected editHolding(): void {
    const row = this.metrics();
    if (!row) return;

    this.dialog
      .open(HoldingDialogComponent, {
        width: '600px',
        data: { holding: row.holding },
      })
      .afterClosed()
      .subscribe((result: HoldingDialogResult | undefined) => {
        if (!result) return;
        const { fees: _fees, ...changes } = result;
        this.portfolio
          .update({ ...row.holding, ...changes })
          .subscribe(() => this.toast.success('Holding updated.'));
      });
  }

  protected deleteHolding(): void {
    const row = this.metrics();
    if (!row) return;

    confirmAction(this.dialog, {
      title: `Delete ${row.holding.symbol}?`,
      message: `The holding and its ${this.history().length} recorded transaction${this.history().length === 1 ? '' : 's'} will be removed permanently.`,
      confirmLabel: 'Delete holding',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.portfolio.deleteWithHistory(row.holding.id).subscribe(() => {
        this.toast.success(`${row.holding.symbol} removed from your portfolio.`);
        void this.router.navigate(['/portfolio']);
      });
    });
  }

  protected toggleWatchlist(): void {
    const row = this.metrics();
    if (!row) return;
    const symbol = row.holding.symbol;
    const existing = this.watchlist.items().find(item => item.symbol === symbol);

    if (existing) {
      this.watchlist
        .remove(existing.id)
        .subscribe(() => this.toast.info(`${symbol} removed from your watchlist.`));
      return;
    }
    this.watchlist.add(symbol).subscribe({
      next: () => this.toast.success(`${symbol} added to your watchlist.`),
      error: (error: Error) => this.toast.error(error.message),
    });
  }

  // ───────────────────────────── Presentation ─────────────────────────────

  protected tickClass(): string {
    const symbol = this.metrics()?.holding.symbol;
    if (!symbol) return '';
    const direction = this.market.direction(symbol);
    if (direction === 'up') return 'tick-up';
    if (direction === 'down') return 'tick-down';
    return '';
  }

  /** Signed cash flow for a ledger row. */
  protected flowOf(side: 'buy' | 'sell', quantity: number, price: number, fees: number): number {
    const gross = quantity * price;
    return side === 'buy' ? -(gross + fees) : gross - fees;
  }
}
