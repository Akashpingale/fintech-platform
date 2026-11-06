import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type CurrencyCode = 'INR' | 'USD' | 'EUR';

interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  label: string;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'INR', symbol: '₹', locale: 'en-IN', label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', locale: 'en-US', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', label: 'Euro (€)' },
];

const STORAGE_KEY = 'fintech-currency';

/**
 * Holds the display currency and formats amounts.
 *
 * Default is INR with `en-IN` grouping (lakh/crore), per Section 11 of the plan.
 * Changing the currency only changes presentation — stored amounts are never
 * converted, which is the honest behaviour without live FX rates.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly storage = inject(StorageService);
  private readonly formatters = new Map<string, Intl.NumberFormat>();

  readonly code = signal<CurrencyCode>(
    this.storage.get<CurrencyCode>(STORAGE_KEY) ?? 'INR'
  );

  setCode(code: CurrencyCode): void {
    this.code.set(code);
    this.storage.set(STORAGE_KEY, code);
  }

  get meta(): CurrencyMeta {
    return CURRENCIES.find(c => c.code === this.code()) ?? CURRENCIES[0];
  }

  /** `₹1,23,456` — no decimals, grouped for the active locale. */
  format(value: number | null | undefined, fractionDigits = 0): string {
    const amount = Number.isFinite(value) ? (value as number) : 0;
    const { code, locale } = this.meta;
    const key = `${locale}|${code}|${fractionDigits}`;
    let formatter = this.formatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
      this.formatters.set(key, formatter);
    }
    return formatter.format(amount);
  }

  /** `₹1.2L`, `₹3.4Cr` for INR; `₹12.3K` below a lakh. Compact card figures. */
  formatCompact(value: number | null | undefined): string {
    const amount = Number.isFinite(value) ? (value as number) : 0;
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    const { symbol, code } = this.meta;

    if (code === 'INR') {
      if (abs >= 1_00_00_000) return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(2)}Cr`;
      if (abs >= 1_00_000) return `${sign}${symbol}${(abs / 1_00_000).toFixed(2)}L`;
      if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
      return `${sign}${symbol}${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${symbol}${abs.toFixed(0)}`;
  }
}
