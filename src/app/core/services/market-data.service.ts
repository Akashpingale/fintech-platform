import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, catchError, interval, of } from 'rxjs';
import { MarketPrice } from '../models/holding.model';
import { StorageService } from './storage.service';

/** CoinGecko ids for the crypto symbols seeded in db.json. */
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  MATIC: 'matic-network',
  DOGE: 'dogecoin',
};

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const STORAGE_KEY = 'marketPrices';

/** Per-symbol tick direction, so the UI can flash green or red. */
export type TickDirection = 'up' | 'down' | 'flat';

/**
 * Live-style market prices.
 *
 * Non-crypto symbols are simulated with a bounded random walk on an RxJS
 * interval — there is no free, key-less intraday API for Indian equities, so
 * the plan calls for simulation. Crypto prices are fetched from CoinGecko's
 * key-less endpoint when it is reachable, and fall back to simulation when it
 * is not (offline, rate-limited, or blocked).
 */
@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);

  /** symbol → latest price. */
  readonly prices = signal<Record<string, MarketPrice>>({});
  /** symbol → direction of the most recent change. */
  readonly lastTick = signal<Record<string, TickDirection>>({});
  readonly isLive = signal(false);
  /** True while the last CoinGecko call succeeded. */
  readonly cryptoLive = signal(false);

  readonly symbols = computed(() => Object.keys(this.prices()));

  private ticker?: Subscription;
  private cryptoPoll?: Subscription;

  /** Loads seed prices from the mock API (or cache) and starts ticking. */
  start(tickMs = 5000): void {
    if (this.isLive()) return;

    this.http
      .get<MarketPrice[]>('/marketPrices')
      .pipe(catchError(() => of(this.storage.get<MarketPrice[]>(STORAGE_KEY) ?? [])))
      .subscribe(list => {
        const map: Record<string, MarketPrice> = {};
        for (const p of list) map[p.symbol] = p;
        this.prices.set(map);
        this.storage.set(STORAGE_KEY, list);
      });

    this.isLive.set(true);
    this.ticker = interval(tickMs).subscribe(() => this.tick());
    // CoinGecko is rate-limited; poll it far less often than the simulation.
    this.fetchCrypto();
    this.cryptoPoll = interval(60_000).subscribe(() => this.fetchCrypto());
  }

  /** Stops all polling (called when the app is torn down or in tests). */
  stop(): void {
    this.ticker?.unsubscribe();
    this.cryptoPoll?.unsubscribe();
    this.ticker = undefined;
    this.cryptoPoll = undefined;
    this.isLive.set(false);
  }

  /** Latest price for a symbol, or null when unknown. */
  priceOf(symbol: string): number | null {
    return this.prices()[symbol]?.price ?? null;
  }

  quote(symbol: string): MarketPrice | null {
    return this.prices()[symbol] ?? null;
  }

  direction(symbol: string): TickDirection {
    return this.lastTick()[symbol] ?? 'flat';
  }

  /** Registers a symbol so it starts receiving simulated ticks. */
  track(symbol: string, seedPrice: number): void {
    if (this.prices()[symbol]) return;
    this.prices.update(current => ({
      ...current,
      [symbol]: {
        symbol,
        price: seedPrice,
        change: 0,
        changePercent: 0,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * One simulated step: each symbol moves by up to ±0.6%, clamped so a long
   * session cannot drift a price to an absurd value.
   */
  private tick(): void {
    const current = this.prices();
    const symbols = Object.keys(current);
    if (symbols.length === 0) return;

    const nextPrices: Record<string, MarketPrice> = { ...current };
    const ticks: Record<string, TickDirection> = {};

    for (const symbol of symbols) {
      // Crypto is driven by the real feed while it is live.
      if (this.cryptoLive() && COINGECKO_IDS[symbol]) continue;

      const quote = current[symbol];
      const drift = (Math.random() - 0.5) * 0.012; // ±0.6%
      const raw = quote.price * (1 + drift);
      const price = Math.max(0.01, Number(raw.toFixed(2)));
      const change = Number((price - quote.price).toFixed(2));

      nextPrices[symbol] = {
        symbol,
        price,
        change,
        changePercent: quote.price
          ? Number(((change / quote.price) * 100).toFixed(2))
          : 0,
        updatedAt: new Date().toISOString(),
      };
      ticks[symbol] = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    }

    this.prices.set(nextPrices);
    this.lastTick.set(ticks);
  }

  /** Pulls real crypto prices in INR; silently keeps simulating on failure. */
  private fetchCrypto(): void {
    const tracked = Object.keys(this.prices()).filter(s => COINGECKO_IDS[s]);
    if (tracked.length === 0) return;

    const ids = tracked.map(s => COINGECKO_IDS[s]).join(',');
    const url = `${COINGECKO_URL}?ids=${encodeURIComponent(ids)}&vs_currencies=inr&include_24hr_change=true`;

    this.http
      .get<Record<string, { inr?: number; inr_24h_change?: number }>>(url)
      .pipe(catchError(() => of(null)))
      .subscribe(response => {
        if (!response) {
          this.cryptoLive.set(false);
          return;
        }
        const next = { ...this.prices() };
        const ticks = { ...this.lastTick() };
        let applied = 0;

        for (const symbol of tracked) {
          const payload = response[COINGECKO_IDS[symbol]];
          const price = payload?.inr;
          if (typeof price !== 'number') continue;
          const previous = next[symbol]?.price ?? price;
          const change = Number((price - previous).toFixed(2));
          next[symbol] = {
            symbol,
            price: Number(price.toFixed(2)),
            change,
            changePercent: Number((payload?.inr_24h_change ?? 0).toFixed(2)),
            updatedAt: new Date().toISOString(),
          };
          ticks[symbol] = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
          applied++;
        }

        if (applied > 0) {
          this.prices.set(next);
          this.lastTick.set(ticks);
          this.cryptoLive.set(true);
        } else {
          this.cryptoLive.set(false);
        }
      });
  }
}
