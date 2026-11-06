import { Injectable, computed } from '@angular/core';
import { AssetTransaction } from '../models/holding.model';
import { CollectionStore } from './collection.store';

/** Buy/sell history for portfolio holdings. */
@Injectable({ providedIn: 'root' })
export class AssetTransactionService extends CollectionStore<AssetTransaction> {
  protected readonly endpoint = '/assetTransactions';
  protected readonly storageKey = 'assetTransactions';

  /** Newest first. */
  readonly sorted = computed(() =>
    [...this.items()].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  );

  /** History for one holding, oldest first (the order a ledger reads). */
  forHolding(holdingId: string): AssetTransaction[] {
    return this.items()
      .filter(t => t.holdingId === holdingId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /** Total fees paid on a holding. */
  feesFor(holdingId: string): number {
    return this.forHolding(holdingId).reduce((sum, t) => sum + t.fees, 0);
  }
}
