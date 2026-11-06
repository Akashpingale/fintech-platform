import { Injectable, computed, effect, inject } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { AssetType, Holding } from '../models/holding.model';
import { CollectionStore } from './collection.store';
import { AssetTransactionService } from './asset-transaction.service';
import { AuthService } from './auth.service';
import { MarketDataService } from './market-data.service';
import {
  CashFlow,
  TargetAllocation,
  allocationByAssetType,
  cagr,
  currentValue,
  diversificationScore,
  investedValue,
  profitLoss,
  rebalanceSuggestions,
  returnPercent,
  xirr,
} from '../../shared/utils/finance.utils';

/** Display labels for each asset type. */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Stocks',
  mutual_fund: 'Mutual Funds',
  crypto: 'Crypto',
  fd: 'Fixed Deposits',
  gold: 'Gold',
  bond: 'Bonds',
};

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  stock: 'show_chart',
  mutual_fund: 'pie_chart',
  crypto: 'currency_bitcoin',
  fd: 'account_balance',
  gold: 'star',
  bond: 'receipt_long',
};

/** A holding joined with its live price and derived metrics. */
export interface HoldingMetrics {
  holding: Holding;
  invested: number;
  current: number;
  pl: number;
  plPercent: number;
  dayChange: number;
  dayChangePercent: number;
  weight: number;
}

/** Default target mix by risk profile, used by the rebalancing suggestion. */
const TARGETS: Record<'low' | 'moderate' | 'high', TargetAllocation> = {
  low: { fd: 40, bond: 20, gold: 15, mutual_fund: 20, stock: 5 },
  moderate: { stock: 35, mutual_fund: 30, fd: 15, gold: 10, crypto: 5, bond: 5 },
  high: { stock: 45, mutual_fund: 25, crypto: 20, gold: 5, bond: 5 },
};

/**
 * Portfolio holdings, live-priced, with the metrics the overview and detail
 * pages render. Prices come from MarketDataService; `currentPrice` on a
 * holding is treated as the seed and last-known value.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioService extends CollectionStore<Holding> {
  protected readonly endpoint = '/holdings';
  protected readonly storageKey = 'holdings';

  private readonly auth = inject(AuthService);
  private readonly market = inject(MarketDataService);
  private readonly assetTx = inject(AssetTransactionService);

  constructor() {
    super();
    // Register every holding's symbol with the price simulator as soon as the
    // list loads, so new holdings start ticking too.
    effect(() => {
      for (const h of this.items()) {
        this.market.track(h.symbol, h.currentPrice || h.avgBuyPrice);
      }
    });
  }

  /** Live price for a holding, falling back to its stored price. */
  priceOf(holding: Holding): number {
    return this.market.priceOf(holding.symbol) ?? holding.currentPrice;
  }

  /** Every holding with its derived metrics, largest position first. */
  readonly metrics = computed<HoldingMetrics[]>(() => {
    const priced = this.items().map(h => ({
      ...h,
      currentPrice: this.priceOf(h),
    }));
    const total = priced.reduce((sum, h) => sum + currentValue(h), 0);

    return priced
      .map(holding => {
        const invested = investedValue(holding);
        const current = currentValue(holding);
        const quote = this.market.quote(holding.symbol);
        const dayChange = (quote?.change ?? 0) * holding.quantity;
        return {
          holding,
          invested,
          current,
          pl: profitLoss(holding),
          plPercent: returnPercent(invested, current),
          dayChange,
          dayChangePercent: quote?.changePercent ?? 0,
          weight: total > 0 ? (current / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.current - a.current);
  });

  readonly totalInvested = computed(() =>
    this.metrics().reduce((sum, m) => sum + m.invested, 0)
  );

  readonly totalCurrent = computed(() =>
    this.metrics().reduce((sum, m) => sum + m.current, 0)
  );

  readonly totalPl = computed(() => this.totalCurrent() - this.totalInvested());

  readonly totalPlPercent = computed(() =>
    returnPercent(this.totalInvested(), this.totalCurrent())
  );

  readonly dayChange = computed(() =>
    this.metrics().reduce((sum, m) => sum + m.dayChange, 0)
  );

  /** Allocation by asset type, for the donut chart. */
  readonly allocation = computed(() =>
    allocationByAssetType(
      this.items().map(h => ({ ...h, currentPrice: this.priceOf(h) }))
    )
  );

  readonly diversification = computed(() =>
    diversificationScore(
      this.items().map(h => ({ ...h, currentPrice: this.priceOf(h) }))
    )
  );

  /** Top five gainers by return percentage. */
  readonly topGainers = computed(() =>
    [...this.metrics()]
      .filter(m => m.plPercent > 0)
      .sort((a, b) => b.plPercent - a.plPercent)
      .slice(0, 5)
  );

  /** Top five losers by return percentage. */
  readonly topLosers = computed(() =>
    [...this.metrics()]
      .filter(m => m.plPercent < 0)
      .sort((a, b) => a.plPercent - b.plPercent)
      .slice(0, 5)
  );

  /**
   * Portfolio CAGR, derived from the weighted-average holding period.
   * Returns 0 until there is at least one holding with a past buy date.
   */
  readonly cagr = computed(() => {
    const items = this.metrics();
    if (items.length === 0) return 0;
    const invested = this.totalInvested();
    if (invested <= 0) return 0;

    const weightedYears = items.reduce((sum, m) => {
      const years =
        (Date.now() - new Date(m.holding.buyDate).getTime()) /
        (365.25 * 24 * 3600 * 1000);
      return sum + Math.max(0, years) * (m.invested / invested);
    }, 0);

    if (weightedYears < 0.02) return 0; // too short a period to annualise
    return cagr(invested, this.totalCurrent(), weightedYears);
  });

  /**
   * XIRR across the recorded buy/sell transactions plus the current value as a
   * terminal inflow. Falls back to the holdings themselves when no asset
   * transactions have been recorded.
   */
  readonly xirr = computed(() => {
    const txs = this.assetTx.items();
    const flows: CashFlow[] = [];

    if (txs.length > 0) {
      for (const t of txs) {
        const gross = t.quantity * t.price;
        flows.push({
          amount: t.side === 'buy' ? -(gross + t.fees) : gross - t.fees,
          date: new Date(t.date),
        });
      }
    } else {
      for (const m of this.metrics()) {
        flows.push({ amount: -m.invested, date: new Date(m.holding.buyDate) });
      }
    }

    const current = this.totalCurrent();
    if (current > 0) flows.push({ amount: current, date: new Date() });
    return xirr(flows);
  });

  /** Rebalancing actions against the target mix for the user's risk profile. */
  readonly rebalance = computed(() => {
    const profile = this.auth.currentUser()?.riskProfile ?? 'moderate';
    return rebalanceSuggestions(
      this.items().map(h => ({ ...h, currentPrice: this.priceOf(h) })),
      TARGETS[profile]
    );
  });

  /** The target mix the rebalancing suggestion compares against. */
  readonly targetAllocation = computed(
    () => TARGETS[this.auth.currentUser()?.riskProfile ?? 'moderate']
  );

  /**
   * Risk score 0–100 from the concentration and composition of the portfolio:
   * volatile asset types (crypto, stocks) raise it, fixed income lowers it,
   * and poor diversification raises it.
   */
  readonly riskScore = computed(() => {
    const allocation = this.allocation();
    if (allocation.length === 0) return 0;
    const weightOf = (type: AssetType) =>
      allocation.find(a => a.type === type)?.percent ?? 0;

    const volatility =
      weightOf('crypto') * 1.0 +
      weightOf('stock') * 0.7 +
      weightOf('mutual_fund') * 0.45 +
      weightOf('gold') * 0.3 +
      weightOf('bond') * 0.15 +
      weightOf('fd') * 0.05;

    const concentrationPenalty = (100 - this.diversification()) * 0.25;
    return Math.round(Math.max(0, Math.min(100, volatility + concentrationPenalty)));
  });

  readonly riskBand = computed<'low' | 'moderate' | 'high'>(() => {
    const score = this.riskScore();
    if (score >= 65) return 'high';
    if (score >= 35) return 'moderate';
    return 'low';
  });

  /**
   * Portfolio value series for the performance chart.
   *
   * Reconstructed from the recorded buy dates: a holding contributes its
   * invested amount from its buy date, and the final point is the live value.
   * This is a cost-basis timeline, not a true historical NAV series — there is
   * no price history in the mock data to compute one.
   */
  performanceSeries(range: '1W' | '1M' | '6M' | '1Y' | 'All'): {
    labels: string[];
    values: number[];
  } {
    const items = this.metrics();
    if (items.length === 0) return { labels: [], values: [] };

    const days = { '1W': 7, '1M': 30, '6M': 182, '1Y': 365, All: 0 }[range];
    const earliestBuy = Math.min(
      ...items.map(m => new Date(m.holding.buyDate).getTime())
    );
    const start =
      days === 0 ? earliestBuy : Math.max(earliestBuy, Date.now() - days * 86_400_000);
    const points = Math.min(30, Math.max(6, Math.round((Date.now() - start) / 86_400_000)));
    const step = (Date.now() - start) / Math.max(1, points - 1);

    const labels: string[] = [];
    const values: number[] = [];
    const totalInvested = this.totalInvested();
    const totalCurrent = this.totalCurrent();

    for (let i = 0; i < points; i++) {
      const at = new Date(start + step * i);
      const investedByThen = items.reduce(
        (sum, m) =>
          new Date(m.holding.buyDate).getTime() <= at.getTime()
            ? sum + m.invested
            : sum,
        0
      );
      // Interpolate the aggregate gain across the window.
      const progress = points === 1 ? 1 : i / (points - 1);
      const gain = (totalCurrent - totalInvested) * progress;
      labels.push(
        at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      );
      values.push(Math.round(investedByThen + gain * (investedByThen / (totalInvested || 1))));
    }
    return { labels, values };
  }

  /** Metrics for one holding by id. */
  metricsFor(id: string): HoldingMetrics | undefined {
    return this.metrics().find(m => m.holding.id === id);
  }

  // ─────────────────────────── Mutations ───────────────────────────

  /** Buys a new position, recording the opening asset transaction. */
  buyNew(
    draft: Omit<Holding, 'id' | 'userId' | 'currentPrice'>,
    fees = 0
  ): Observable<Holding> {
    return this.create({
      ...draft,
      userId: this.auth.userId(),
      currentPrice: draft.avgBuyPrice,
    }).pipe(
      switchMap(holding => {
        this.market.track(holding.symbol, holding.avgBuyPrice);
        return this.assetTx
          .create({
            holdingId: holding.id,
            side: 'buy',
            quantity: draft.quantity,
            price: draft.avgBuyPrice,
            fees,
            date: draft.buyDate,
          })
          .pipe(map(() => holding));
      })
    );
  }

  /**
   * Adds to an existing position, re-deriving the weighted average buy price.
   */
  buyMore(
    id: string,
    quantity: number,
    price: number,
    fees = 0,
    date = new Date().toISOString().slice(0, 10)
  ): Observable<Holding> {
    const holding = this.find(id);
    if (!holding) return throwError(() => new Error('Holding not found.'));
    if (quantity <= 0) return throwError(() => new Error('Quantity must be positive.'));

    const totalQty = holding.quantity + quantity;
    const avgBuyPrice =
      (holding.avgBuyPrice * holding.quantity + price * quantity) / totalQty;

    return this.patch(id, {
      quantity: totalQty,
      avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
    }).pipe(
      switchMap(updated =>
        this.assetTx
          .create({
            holdingId: id,
            side: 'buy',
            quantity,
            price,
            fees,
            date,
          })
          .pipe(map(() => updated))
      )
    );
  }

  /**
   * Sells part or all of a position. Selling the full quantity deletes the
   * holding; the average buy price is left untouched on a partial sale, which
   * is how realised cost basis works.
   */
  sell(
    id: string,
    quantity: number,
    price: number,
    fees = 0,
    date = new Date().toISOString().slice(0, 10)
  ): Observable<{ realised: number; closed: boolean }> {
    const holding = this.find(id);
    if (!holding) return throwError(() => new Error('Holding not found.'));
    if (quantity <= 0) return throwError(() => new Error('Quantity must be positive.'));
    if (quantity > holding.quantity) {
      return throwError(
        () => new Error(`You only hold ${holding.quantity} units of ${holding.symbol}.`)
      );
    }

    const realised = (price - holding.avgBuyPrice) * quantity - fees;
    const remaining = holding.quantity - quantity;

    return this.assetTx
      .create({ holdingId: id, side: 'sell', quantity, price, fees, date })
      .pipe(
        switchMap(() =>
          remaining === 0
            ? this.remove(id).pipe(map(() => ({ realised, closed: true })))
            : this.patch(id, { quantity: remaining }).pipe(
                map(() => ({ realised, closed: false }))
              )
        )
      );
  }

  /** Deletes a holding and its recorded transactions. */
  deleteWithHistory(id: string): Observable<void> {
    const txIds = this.assetTx.forHolding(id).map(t => t.id);
    return this.remove(id).pipe(
      switchMap(() => (txIds.length ? this.assetTx.removeMany(txIds) : of(undefined)))
    );
  }
}
