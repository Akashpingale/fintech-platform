import { Component, input } from '@angular/core';

/**
 * Shimmer placeholder shown while data loads, so a page never flashes blank
 * (Section 16.9).
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @for (row of rowList(); track row) {
      <div
        class="skeleton"
        [style.height]="height()"
        [style.width]="row === rowList().length - 1 ? lastWidth() : width()"
        [style.border-radius]="radius()"
      ></div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        width: 100%;
      }
    `,
  ],
})
export class SkeletonComponent {
  readonly rows = input(1);
  readonly height = input('16px');
  readonly width = input('100%');
  /** Narrower final row reads more like real text. */
  readonly lastWidth = input('70%');
  readonly radius = input('var(--r-sm)');

  protected rowList(): number[] {
    return Array.from({ length: Math.max(1, this.rows()) }, (_, i) => i);
  }
}
