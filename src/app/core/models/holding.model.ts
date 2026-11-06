/** Investment asset types */
export type AssetType = 'stock' | 'mutual_fund' | 'crypto' | 'fd' | 'gold' | 'bond';

/** Portfolio holding model */
export interface Holding {
  id: string;
  userId: string;
  assetType: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  buyDate: string; // ISO date string
}

/** Buy/Sell transaction for an asset */
export interface AssetTransaction {
  id: string;
  holdingId: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  date: string; // ISO date string
}

/** Watchlist item */
export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  alertAbove?: number;
  alertBelow?: number;
}

/** Market price entry */
export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}
