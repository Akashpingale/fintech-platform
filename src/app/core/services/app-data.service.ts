import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, switchMap, tap } from 'rxjs';
import { TransactionService } from './transaction.service';
import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { PortfolioService } from './portfolio.service';
import { AssetTransactionService } from './asset-transaction.service';
import { SipService } from './sip.service';
import { WatchlistService } from './watchlist.service';
import { NotificationCenterService } from './notification-center.service';
import { MarketDataService } from './market-data.service';
import { netWorth } from '../../shared/utils/finance.utils';

/**
 * Loads every collection once, starts the price feed, and exposes the few
 * figures that span modules (net worth, cash balance).
 *
 * Called from the shell so a page can be deep-linked without each component
 * having to orchestrate its own loading.
 */
@Injectable({ providedIn: 'root' })
export class AppDataService {
  private readonly transactions = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly goals = inject(GoalService);
  private readonly portfolio = inject(PortfolioService);
  private readonly assetTx = inject(AssetTransactionService);
  private readonly sips = inject(SipService);
  private readonly watchlist = inject(WatchlistService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly market = inject(MarketDataService);

  readonly ready = signal(false);

  /** Cash left over from recorded income and expenses. */
  readonly cashBalance = computed(
    () => this.transactions.totalIncome() - this.transactions.totalExpense()
  );

  /**
   * Net worth = cash balance + portfolio value + money set aside in goals.
   * Liabilities are not modelled in this app, so none are subtracted.
   */
  readonly netWorth = computed(() =>
    netWorth(
      this.cashBalance(),
      this.portfolio.totalCurrent(),
      this.goals.totalSaved()
    )
  );

  /** Loads everything, then generates recurring entries and fresh alerts. */
  bootstrap(): void {
    if (this.ready()) return;

    this.market.start();

    forkJoin([
      this.transactions.load(),
      this.budgets.load(),
      this.goals.load(),
      this.portfolio.load(),
      this.assetTx.load(),
      this.sips.load(),
      this.watchlist.load(),
      this.notifications.load(),
    ])
      .pipe(
        tap(() => this.ready.set(true)),
        // Recurring entries first, so budget alerts see the complete month.
        switchMap(() => this.transactions.generateRecurring()),
        switchMap(() => this.notifications.refreshAlerts())
      )
      .subscribe({
        error: () => this.ready.set(true),
      });
  }

  /** Re-reads every collection from the mock API. */
  reload(): void {
    forkJoin([
      this.transactions.load(true),
      this.budgets.load(true),
      this.goals.load(true),
      this.portfolio.load(true),
      this.assetTx.load(true),
      this.sips.load(true),
      this.watchlist.load(true),
      this.notifications.load(true),
    ]).subscribe();
  }
}
