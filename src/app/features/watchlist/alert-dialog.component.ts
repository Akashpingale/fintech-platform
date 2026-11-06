import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { nonNegativeNumber } from '../../shared/validators/app.validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export interface AlertDialogData {
  symbol: string;
  price: number;
  alertAbove?: number;
  alertBelow?: number;
}

export interface AlertDialogResult {
  alertAbove?: number;
  alertBelow?: number;
}

/** Set or clear the price alert thresholds for a watched symbol. */
@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MoneyPipe,
  ],
  template: `
    <h2 mat-dialog-title>Price alerts · {{ data.symbol }}</h2>

    <mat-dialog-content>
      <p class="muted current">
        Current price: <strong>{{ data.price | money: 2 }}</strong>
      </p>

      <form [formGroup]="form" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Alert when price rises above (₹)</mat-label>
          <input matInput type="number" min="0" formControlName="alertAbove" />
          <mat-icon matPrefix>trending_up</mat-icon>
          <mat-hint>Leave blank for no upper alert</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Alert when price falls below (₹)</mat-label>
          <input matInput type="number" min="0" formControlName="alertBelow" />
          <mat-icon matPrefix>trending_down</mat-icon>
          <mat-hint>Leave blank for no lower alert</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button type="button" class="btn btn--primary" (click)="save()">
        Save alerts
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 340px;
      }
      .current {
        margin: 0 0 var(--sp-4);
      }
    `,
  ],
})
export class AlertDialogComponent {
  protected readonly data = inject<AlertDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<AlertDialogComponent, AlertDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.group({
    alertAbove: [this.data.alertAbove ?? null, [nonNegativeNumber()]],
    alertBelow: [this.data.alertBelow ?? null, [nonNegativeNumber()]],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { alertAbove, alertBelow } = this.form.getRawValue();
    this.ref.close({
      alertAbove:
        alertAbove !== null && Number(alertAbove) > 0 ? Number(alertAbove) : undefined,
      alertBelow:
        alertBelow !== null && Number(alertBelow) > 0 ? Number(alertBelow) : undefined,
    });
  }

  protected close(): void {
    this.ref.close();
  }
}
