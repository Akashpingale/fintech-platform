import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a percentage with an explicit direction marker, so gains and losses
 * are never distinguished by colour alone (Section 16.11 accessibility rule).
 *
 * Usage: `{{ 12.345 | percentChange }}` → ▲ 12.35%
 *        `{{ -3.2 | percentChange: 1 }}` → ▼ 3.2%
 */
@Pipe({ name: 'percentChange', standalone: true })
export class PercentChangePipe implements PipeTransform {
  transform(value: number | null | undefined, fractionDigits = 2): string {
    const n = Number.isFinite(value) ? (value as number) : 0;
    const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '•';
    return `${arrow} ${Math.abs(n).toFixed(fractionDigits)}%`;
  }
}
