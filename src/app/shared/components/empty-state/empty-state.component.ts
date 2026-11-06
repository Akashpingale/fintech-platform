import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Illustrated placeholder shown whenever a list or chart has no data yet. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="empty">
      <mat-icon class="empty__icon">{{ icon() }}</mat-icon>
      <h3 class="empty__title">{{ title() }}</h3>
      @if (message()) {
        <p class="empty__message">{{ message() }}</p>
      }
      @if (actionLabel()) {
        <button type="button" class="btn btn--primary" (click)="action.emit()">
          <mat-icon>{{ actionIcon() }}</mat-icon>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .empty__icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--text-muted);
        opacity: 0.55;
        margin-bottom: var(--sp-3);
      }
      .empty__title {
        font-size: 1.0625rem;
        color: var(--text);
        margin-bottom: var(--sp-2);
      }
      .empty__message {
        margin: 0 auto var(--sp-4);
        max-width: 42ch;
      }
      .btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly actionLabel = input('');
  readonly actionIcon = input('add');
  readonly action = output<void>();
}
