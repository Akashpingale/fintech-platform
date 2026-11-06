import { Component, input } from '@angular/core';

/**
 * Consistent page title block with a slot for actions on the right.
 *
 * Usage:
 * ```html
 * <app-page-header title="Transactions" subtitle="42 records">
 *   <button slot="actions" class="btn btn--primary">Add</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page__header">
      <div>
        <h1 class="page__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page__actions">
        <ng-content select="[slot=actions]" />
      </div>
    </header>
  `,
  styles: [
    `
      .page__title {
        font-size: var(--fs-h1);
        font-weight: 700;
      }
      .page__subtitle {
        margin: 4px 0 0;
        color: var(--text-muted);
        font-size: var(--fs-caption);
      }
      .page__actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
