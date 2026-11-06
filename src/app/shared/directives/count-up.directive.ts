import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

/**
 * Animates a number from its previous value to the new one (Section 16.9).
 *
 * Respects `prefers-reduced-motion` by writing the final value immediately.
 *
 * Usage: `<span [countUp]="netWorth()" format="money"></span>`
 */
@Directive({ selector: '[countUp]', standalone: true })
export class CountUpDirective implements OnDestroy {
  /** Target value. */
  readonly countUp = input.required<number>();
  /** How to render the running value. */
  readonly format = input<'money' | 'moneyCompact' | 'number' | 'percent'>('number');
  /** Animation duration in ms. */
  readonly duration = input(900);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly currency = inject(CurrencyService);
  private frame = 0;
  private displayed = 0;

  constructor() {
    effect(() => {
      const target = this.countUp();
      if (this.prefersReducedMotion()) {
        this.render(target);
        this.displayed = target;
        return;
      }
      this.animateTo(target);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.frame);
    const from = this.displayed;
    const delta = target - from;
    if (delta === 0) {
      this.render(target);
      return;
    }
    const start = performance.now();
    const total = this.duration();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / total);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + delta * eased;
      this.render(value);
      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        this.displayed = target;
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  private render(value: number): void {
    this.el.nativeElement.textContent = this.stringify(value);
  }

  private stringify(value: number): string {
    switch (this.format()) {
      case 'money':
        return this.currency.format(value);
      case 'moneyCompact':
        return this.currency.formatCompact(value);
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return Math.round(value).toLocaleString('en-IN');
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
