import { Directive, computed, effect, inject, input } from '@angular/core';
import { ElementRef } from '@angular/core';

/**
 * Applies the shared `.gain` / `.loss` classes based on the sign of a value,
 * so P/L figures are styled consistently everywhere.
 *
 * Usage: `<span [appHighlightNegative]="holding.pl">…</span>`
 */
@Directive({ selector: '[appHighlightNegative]', standalone: true })
export class HighlightNegativeDirective {
  readonly appHighlightNegative = input.required<number>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tone = computed(() => {
    const v = this.appHighlightNegative();
    return v > 0 ? 'gain' : v < 0 ? 'loss' : '';
  });

  constructor() {
    effect(() => {
      const node = this.el.nativeElement;
      node.classList.remove('gain', 'loss');
      const tone = this.tone();
      if (tone) node.classList.add(tone);
    });
  }
}
