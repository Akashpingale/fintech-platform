import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TransactionService } from './transaction.service';
import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { PortfolioService } from './portfolio.service';
import { AssetTransactionService } from './asset-transaction.service';
import { SipService } from './sip.service';
import { WatchlistService } from './watchlist.service';
import { NotificationCenterService } from './notification-center.service';

/** Shape of the JSON backup file. */
export interface BackupFile {
  app: 'fintrack';
  version: 1;
  exportedAt: string;
  data: {
    transactions: unknown[];
    budgets: unknown[];
    goals: unknown[];
    holdings: unknown[];
    assetTransactions: unknown[];
    sips: unknown[];
    watchlist: unknown[];
    notifications: unknown[];
  };
}

export interface RestoreSummary {
  [collection: string]: number;
}

/**
 * Backup and restore of all user data as a single JSON file (Section 3.12).
 *
 * Restore writes into the in-memory stores and their localStorage mirror; it
 * does not push the records back into json-server, so db.json is left as the
 * pristine seed. Reloading the page after a restore re-reads json-server and
 * the restored data is replaced — that boundary is called out in the UI.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly transactions = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly goals = inject(GoalService);
  private readonly portfolio = inject(PortfolioService);
  private readonly assetTx = inject(AssetTransactionService);
  private readonly sips = inject(SipService);
  private readonly watchlist = inject(WatchlistService);
  private readonly notifications = inject(NotificationCenterService);

  /** Builds the backup object from the loaded stores. */
  snapshot(): BackupFile {
    return {
      app: 'fintrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        transactions: this.transactions.items(),
        budgets: this.budgets.items(),
        goals: this.goals.items(),
        holdings: this.portfolio.items(),
        assetTransactions: this.assetTx.items(),
        sips: this.sips.items(),
        watchlist: this.watchlist.items(),
        notifications: this.notifications.items(),
      },
    };
  }

  /** Downloads the backup as a formatted JSON file. */
  download(): void {
    const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fintrack-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Restores from a backup file, replacing the current data.
   * Rejects files that are not FinTrack backups rather than importing garbage.
   */
  restore(file: File): Observable<RestoreSummary> {
    return this.readJson(file).pipe(
      map(parsed => {
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          (parsed as BackupFile).app !== 'fintrack'
        ) {
          throw new Error('That is not a FinTrack backup file.');
        }
        const data = (parsed as BackupFile).data;
        if (!data || typeof data !== 'object') {
          throw new Error('The backup file has no data section.');
        }

        const summary: RestoreSummary = {};
        const apply = <T extends { id: string }>(
          list: unknown[] | undefined,
          store: { replaceAll(items: readonly T[]): void },
          name: string
        ) => {
          if (!Array.isArray(list)) return;
          store.replaceAll(list as T[]);
          summary[name] = list.length;
        };

        apply(data.transactions, this.transactions, 'transactions');
        apply(data.budgets, this.budgets, 'budgets');
        apply(data.goals, this.goals, 'goals');
        apply(data.holdings, this.portfolio, 'holdings');
        apply(data.assetTransactions, this.assetTx, 'assetTransactions');
        apply(data.sips, this.sips, 'sips');
        apply(data.watchlist, this.watchlist, 'watchlist');
        apply(data.notifications, this.notifications, 'notifications');

        return summary;
      })
    );
  }

  private readJson(file: File): Observable<unknown> {
    return new Observable<unknown>(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          observer.next(JSON.parse(String(reader.result ?? '')));
          observer.complete();
        } catch {
          observer.error(new Error('The file is not valid JSON.'));
        }
      };
      reader.onerror = () => observer.error(new Error('Could not read the file.'));
      reader.readAsText(file);
      return () => reader.abort();
    });
  }
}
