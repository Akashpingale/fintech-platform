import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CountUpDirective } from '../../directives/count-up.directive';
import { PercentChangePipe } from '../../pipes/percent-change.pipe';

/**
 * Summary metric tile used across the dashboard and overview pages.
 * The figure counts up on load; the delta badge always carries an arrow so
 * direction is never conveyed by colour alone.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule, CountUpDirective, PercentChangePipe],
  template: `
    <div class="card card--hover stat-card">
      <div class="stat-card__icon" [style.background]="iconBg()" [style.color]="iconColor()">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <div class="stat-card__body">
        <div class="stat-card__label">{{ label() }}</div>
        <div class="stat-card__value num" [countUp]="value()" [format]="format()"></div>
        @if (delta() !== null) {
          <span class="badge" [class]="deltaClass()">
            {{ delta()! | percentChange: 1 }}
            @if (deltaLabel()) {
              <span class="delta-label">{{ deltaLabel() }}</span>
            }
          </span>
        } @else if (hint()) {
          <span class="stat-card__hint">{{ hint() }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .stat-card__body {
        min-width: 0;
      }
      .stat-card__value {
        line-height: 1.25;
      }
      .stat-card__hint {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .delta-label {
        font-weight: 500;
        opacity: 0.85;
      }
      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    `,
  ],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly icon = input('insights');
  readonly format = input<'money' | 'moneyCompact' | 'number' | 'percent'>('money');
  /** Period-over-period change in percent, or null to hide the badge. */
  readonly delta = input<number | null>(null);
  readonly deltaLabel = input('');
  readonly hint = input('');
  /** Colour accent for the icon tile. */
  readonly tone = input<'primary' | 'success' | 'danger' | 'warning'>('primary');
  /** Set when a rising value is bad (e.g. expenses), to flip the badge colour. */
  readonly invertDelta = input(false);

  protected readonly iconBg = computed(() => `var(--${this.tone()}-soft)`);
  protected readonly iconColor = computed(() => `var(--${this.tone()})`);

  protected readonly deltaClass = computed(() => {
    const d = this.delta() ?? 0;
    const good = this.invertDelta() ? d < 0 : d > 0;
    if (d === 0) return 'badge--info';
    return good ? 'badge--gain' : 'badge--loss';
  });
}
