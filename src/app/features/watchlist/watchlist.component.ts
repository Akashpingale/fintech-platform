import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import {
  WatchlistRow,
  WatchlistService,
} from '../../core/services/watchlist.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PercentChangePipe } from '../../shared/pipes/percent-change.pipe';
import {
  AlertDialogComponent,
  AlertDialogResult,
} from './alert-dialog.component';
import { nonNegativeNumber } from '../../shared/validators/app.validators';

/**
 * Watchlist — Section 3.6.
 * Watched symbols with live quotes and above/below price alerts.
 */
@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
    PercentChangePipe,
  ],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.scss',
})
export class WatchlistComponent {
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly portfolio = inject(PortfolioService);

  protected readonly watchlist = inject(WatchlistService);
  protected readonly market = inject(MarketDataService);

  protected readonly loading = computed(() => !this.watchlist.loaded());
  protected readonly rows = computed(() => this.watchlist.rows());
  protected readonly triggered = computed(() => this.watchlist.triggeredRows());

  protected readonly addForm = this.fb.nonNullable.group({
    symbol: ['', [Validators.required, Validators.maxLength(16)]],
    alertAbove: [null as number | null, [nonNegativeNumber()]],
    alertBelow: [null as number | null, [nonNegativeNumber()]],
  });

  /** Symbols already held, so a watched symbol can link to its holding. */
  protected readonly heldSymbols = computed(
    () => new Map(this.portfolio.items().map(h => [h.symbol, h.id]))
  );

  protected holdingIdFor(symbol: string): string | undefined {
    return this.heldSymbols().get(symbol);
  }

  protected add(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const { symbol, alertAbove, alertBelow } = this.addForm.getRawValue();

    this.watchlist
      .add(
        symbol,
        alertAbove !== null && alertAbove > 0 ? Number(alertAbove) : undefined,
        alertBelow !== null && alertBelow > 0 ? Number(alertBelow) : undefined
      )
      .subscribe({
        next: created => {
          // Seed a price so the new symbol starts ticking immediately.
          if (!this.market.quote(created.symbol)) {
            this.market.track(created.symbol, created.alertAbove ?? created.alertBelow ?? 1000);
          }
          this.toast.success(`${created.symbol} added to your watchlist.`);
          this.addForm.reset({ symbol: '', alertAbove: null, alertBelow: null });
        },
        error: (error: Error) => this.toast.error(error.message),
      });
  }

  protected editAlerts(row: WatchlistRow): void {
    this.dialog
      .open(AlertDialogComponent, {
        width: '440px',
        data: {
          symbol: row.item.symbol,
          price: row.quote?.price ?? 0,
          alertAbove: row.item.alertAbove,
          alertBelow: row.item.alertBelow,
        },
      })
      .afterClosed()
      .subscribe((result: AlertDialogResult | undefined) => {
        if (!result) return;
        this.watchlist
          .setAlerts(row.item.id, result.alertAbove, result.alertBelow)
          .subscribe(() => {
            this.toast.success(`Alerts updated for ${row.item.symbol}.`);
            this.notifications.refreshAlerts().subscribe();
          });
      });
  }

  protected remove(row: WatchlistRow): void {
    confirmAction(this.dialog, {
      title: `Stop watching ${row.item.symbol}?`,
      message: 'Its price alerts will be removed too.',
      confirmLabel: 'Remove',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.watchlist
        .remove(row.item.id)
        .subscribe(() => this.toast.success(`${row.item.symbol} removed.`));
    });
  }

  protected tickClass(symbol: string): string {
    const direction = this.market.direction(symbol);
    if (direction === 'up') return 'tick-up';
    if (direction === 'down') return 'tick-down';
    return '';
  }

  protected alertSummary(row: WatchlistRow): string {
    const parts: string[] = [];
    if (row.item.alertAbove !== undefined) {
      parts.push(`above ₹${row.item.alertAbove.toLocaleString('en-IN')}`);
    }
    if (row.item.alertBelow !== undefined) {
      parts.push(`below ₹${row.item.alertBelow.toLocaleString('en-IN')}`);
    }
    return parts.length ? `Alert ${parts.join(' or ')}` : 'No alerts set';
  }
}
