import { Injectable, computed, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { MarketPrice, WatchlistItem } from '../models/holding.model';
import { CollectionStore } from './collection.store';
import { AuthService } from './auth.service';
import { MarketDataService } from './market-data.service';

/** A watched symbol joined with its live quote and alert state. */
export interface WatchlistRow {
  item: WatchlistItem;
  quote: MarketPrice | null;
  /** Which alert, if any, the current price has crossed. */
  triggered: 'above' | 'below' | null;
}

/** Watched symbols with price alerts. */
@Injectable({ providedIn: 'root' })
export class WatchlistService extends CollectionStore<WatchlistItem> {
  protected readonly endpoint = '/watchlist';
  protected readonly storageKey = 'watchlist';

  private readonly auth = inject(AuthService);
  private readonly market = inject(MarketDataService);

  /** Watched symbols with live quotes; triggered alerts first. */
  readonly rows = computed<WatchlistRow[]>(() =>
    this.items()
      .map(item => {
        const quote = this.market.quote(item.symbol);
        return { item, quote, triggered: this.evaluate(item, quote) };
      })
      .sort((a, b) => {
        if (a.triggered && !b.triggered) return -1;
        if (b.triggered && !a.triggered) return 1;
        return a.item.symbol.localeCompare(b.item.symbol);
      })
  );

  readonly triggeredRows = computed(() =>
    this.rows().filter(r => r.triggered !== null)
  );

  /** Adds a symbol, rejecting duplicates. */
  add(
    symbol: string,
    alertAbove?: number,
    alertBelow?: number
  ): Observable<WatchlistItem> {
    const normalised = symbol.trim().toUpperCase();
    if (!normalised) return throwError(() => new Error('Enter a symbol.'));
    if (this.items().some(i => i.symbol === normalised)) {
      return throwError(() => new Error(`${normalised} is already on your watchlist.`));
    }
    return this.create({
      userId: this.auth.userId(),
      symbol: normalised,
      alertAbove,
      alertBelow,
    });
  }

  /** Updates the alert thresholds on a watched symbol. */
  setAlerts(
    id: string,
    alertAbove?: number,
    alertBelow?: number
  ): Observable<WatchlistItem> {
    return this.patch(id, { alertAbove, alertBelow });
  }

  /** Whether the live price has crossed either threshold. */
  private evaluate(
    item: WatchlistItem,
    quote: MarketPrice | null
  ): 'above' | 'below' | null {
    if (!quote) return null;
    if (item.alertAbove !== undefined && quote.price >= item.alertAbove) {
      return 'above';
    }
    if (item.alertBelow !== undefined && quote.price <= item.alertBelow) {
      return 'below';
    }
    return null;
  }
}
