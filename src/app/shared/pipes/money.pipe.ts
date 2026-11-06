import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

/**
 * Formats an amount in the user's selected currency (default ₹ with en-IN
 * grouping).
 *
 * Declared impure because the result depends on the CurrencyService signal
 * rather than only on the input value: a pure pipe would keep serving the old
 * currency from its cache after the user switches. Formatters are cached inside
 * CurrencyService, so each call is a single `Intl` format.
 *
 * Usage: `{{ 125000 | money }}` → ₹1,25,000
 *        `{{ 1234.5 | money: 2 }}` → ₹1,234.50
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(value: number | null | undefined, fractionDigits = 0): string {
    return this.currency.format(value, fractionDigits);
  }
}

/** Compact variant: `{{ 4520000 | moneyCompact }}` → ₹45.20L */
@Pipe({ name: 'moneyCompact', standalone: true, pure: false })
export class MoneyCompactPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(value: number | null | undefined): string {
    return this.currency.formatCompact(value);
  }
}
