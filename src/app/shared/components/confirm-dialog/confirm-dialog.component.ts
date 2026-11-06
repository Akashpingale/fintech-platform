import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` is for destructive actions (delete, bulk delete, reset). */
  tone?: 'danger' | 'primary';
  icon?: string;
}

/** Yes/no dialog used before any destructive or irreversible action. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm">
      <div class="confirm__icon" [class.danger]="isDanger">
        <mat-icon>{{ data.icon ?? (isDanger ? 'warning' : 'help_outline') }}</mat-icon>
      </div>
      <h2 class="confirm__title">{{ data.title }}</h2>
      <p class="confirm__message">{{ data.message }}</p>
      <div class="confirm__actions">
        <button type="button" class="btn btn--ghost" (click)="close(false)">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn--danger]="isDanger"
          [class.btn--primary]="!isDanger"
          (click)="close(true)"
        >
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirm {
        padding: var(--sp-5);
        text-align: center;
        max-width: 420px;
      }
      .confirm__icon {
        width: 56px;
        height: 56px;
        margin: 0 auto var(--sp-4);
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--primary-soft);
        color: var(--primary);
      }
      .confirm__icon.danger {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .confirm__icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
      .confirm__title {
        font-size: 1.125rem;
        margin-bottom: var(--sp-2);
      }
      .confirm__message {
        color: var(--text-muted);
        margin: 0 0 var(--sp-5);
      }
      .confirm__actions {
        display: flex;
        gap: var(--sp-3);
        justify-content: center;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(
    MatDialogRef
  );

  protected get isDanger(): boolean {
    return this.data.tone === 'danger';
  }

  protected close(result: boolean): void {
    this.ref.close(result);
  }
}

/**
 * Opens the confirm dialog and emits true only when the user confirms.
 * Call from a component: `confirmAction(this.dialog, { ... })`.
 */
export function confirmAction(
  dialog: MatDialog,
  data: ConfirmDialogData
): Observable<boolean> {
  return dialog
    .open(ConfirmDialogComponent, {
      data,
      width: '440px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    })
    .afterClosed() as Observable<boolean>;
}
