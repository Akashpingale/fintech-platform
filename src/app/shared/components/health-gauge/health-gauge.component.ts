import { Component, computed, input } from '@angular/core';

/**
 * Semi-circular gauge for the financial health score (Section 16.8, Analytics).
 * The band label is shown as text next to the figure so the reading does not
 * rely on the arc colour alone.
 */
@Component({
  selector: 'app-health-gauge',
  standalone: true,
  template: `
    <div class="gauge">
      <svg viewBox="0 0 200 116" class="gauge__svg" role="img" [attr.aria-label]="ariaLabel()">
        <path
          class="gauge__track"
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke-width="16"
          stroke-linecap="round"
        />
        <path
          class="gauge__bar"
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke-width="16"
          stroke-linecap="round"
          [attr.stroke]="colour()"
          [attr.stroke-dasharray]="arcLength"
          [attr.stroke-dashoffset]="dashOffset()"
        />
        <text x="100" y="86" text-anchor="middle" class="gauge__score num">
          {{ rounded() }}
        </text>
        <text x="100" y="106" text-anchor="middle" class="gauge__max">out of 100</text>
      </svg>
      <div class="gauge__band" [style.color]="colour()">{{ bandLabel() }}</div>
    </div>
  `,
  styles: [
    `
      .gauge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-2);
      }
      .gauge__svg {
        width: 100%;
        max-width: 240px;
      }
      .gauge__track {
        stroke: var(--surface-2);
      }
      .gauge__bar {
        transition: stroke-dashoffset 0.8s var(--ease);
      }
      .gauge__score {
        fill: var(--text);
        font-size: 2.25rem;
        font-weight: 800;
      }
      .gauge__max {
        fill: var(--text-muted);
        font-size: 0.75rem;
      }
      .gauge__band {
        font-weight: 700;
        text-transform: capitalize;
        letter-spacing: 0.02em;
      }
      @media (prefers-reduced-motion: reduce) {
        .gauge__bar {
          transition: none;
        }
      }
    `,
  ],
})
export class HealthGaugeComponent {
  readonly score = input.required<number>();
  readonly band = input<'poor' | 'fair' | 'good' | 'excellent'>('fair');

  /** Length of the 180° arc at r=84: π × 84. */
  protected readonly arcLength = Math.PI * 84;

  protected readonly rounded = computed(() =>
    Math.max(0, Math.min(100, Math.round(this.score())))
  );
  protected readonly dashOffset = computed(
    () => this.arcLength * (1 - this.rounded() / 100)
  );
  protected readonly colour = computed(() => {
    switch (this.band()) {
      case 'excellent':
        return 'var(--success)';
      case 'good':
        return 'var(--secondary)';
      case 'fair':
        return 'var(--warning)';
      default:
        return 'var(--danger)';
    }
  });
  protected readonly bandLabel = computed(() => `${this.band()} health`);
  protected readonly ariaLabel = computed(
    () => `Financial health score ${this.rounded()} out of 100, rated ${this.band()}`
  );
}
