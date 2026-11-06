import { Component, computed, input } from '@angular/core';

/**
 * SVG circular progress ring used for savings-goal cards.
 * Colour follows the same green/amber/red bands as the budget bars.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  template: `
    <svg
      class="ring"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      role="img"
      [attr.aria-label]="label() + ': ' + rounded() + '% complete'"
    >
      <circle
        class="ring__track"
        [attr.cx]="centre()"
        [attr.cy]="centre()"
        [attr.r]="radius()"
        [attr.stroke-width]="thickness()"
        fill="none"
      />
      <circle
        class="ring__bar"
        [attr.cx]="centre()"
        [attr.cy]="centre()"
        [attr.r]="radius()"
        [attr.stroke-width]="thickness()"
        [attr.stroke]="colour()"
        [attr.stroke-dasharray]="circumference()"
        [attr.stroke-dashoffset]="dashOffset()"
        stroke-linecap="round"
        fill="none"
        [attr.transform]="'rotate(-90 ' + centre() + ' ' + centre() + ')'"
      />
      <text
        class="ring__value num"
        [attr.x]="centre()"
        [attr.y]="centre()"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ rounded() }}%
      </text>
    </svg>
  `,
  styles: [
    `
      .ring__track {
        stroke: var(--surface-2);
      }
      .ring__bar {
        transition: stroke-dashoffset 0.7s var(--ease);
      }
      .ring__value {
        fill: var(--text);
        font-size: 0.875rem;
        font-weight: 700;
      }
      @media (prefers-reduced-motion: reduce) {
        .ring__bar {
          transition: none;
        }
      }
    `,
  ],
})
export class ProgressRingComponent {
  /** Completion percentage; values above 100 are clamped for drawing. */
  readonly percent = input.required<number>();
  readonly size = input(96);
  readonly thickness = input(9);
  readonly label = input('Progress');
  /** Overrides the automatic green/amber/red colour. */
  readonly colourOverride = input<string | null>(null);

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(100, this.percent()))
  );
  protected readonly rounded = computed(() => Math.round(this.percent()));
  protected readonly centre = computed(() => this.size() / 2);
  protected readonly radius = computed(
    () => this.size() / 2 - this.thickness() / 2 - 1
  );
  protected readonly circumference = computed(
    () => 2 * Math.PI * this.radius()
  );
  protected readonly dashOffset = computed(
    () => this.circumference() * (1 - this.clamped() / 100)
  );

  protected readonly colour = computed(() => {
    const override = this.colourOverride();
    if (override) return override;
    const pct = this.clamped();
    if (pct >= 100) return 'var(--success)';
    if (pct >= 50) return 'var(--primary)';
    if (pct >= 25) return 'var(--warning)';
    return 'var(--danger)';
  });
}
