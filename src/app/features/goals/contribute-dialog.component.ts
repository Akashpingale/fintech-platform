import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Goal } from '../../core/models/goal.model';
import {
  firstErrorMessage,
  positiveNumber,
} from '../../shared/validators/app.validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export interface ContributeDialogData {
  goal: Goal;
  monthlyNeeded: number;
}

/** Add money to, or withdraw money from, a savings goal. */
@Component({
  selector: 'app-contribute-dialog',
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
    <h2 mat-dialog-title>
      {{ mode() === 'add' ? 'Add money' : 'Withdraw' }} · {{ data.goal.name }}
    </h2>

    <mat-dialog-content>
      <div class="summary">
        <div class="kv">
          <span class="kv__key">Saved so far</span>
          <span class="kv__value">{{ data.goal.savedAmount | money }}</span>
        </div>
        <div class="kv">
          <span class="kv__key">Target</span>
          <span class="kv__value">{{ data.goal.targetAmount | money }}</span>
        </div>
        <div class="kv">
          <span class="kv__key">Still needed</span>
          <span class="kv__value">{{ remaining() | money }}</span>
        </div>
      </div>

      <div class="mode-switch">
        <button
          type="button"
          class="chip"
          [class.active]="mode() === 'add'"
          (click)="mode.set('add')"
        >
          <mat-icon class="chip-icon">add</mat-icon>
          Add money
        </button>
        <button
          type="button"
          class="chip"
          [class.active]="mode() === 'withdraw'"
          (click)="mode.set('withdraw')"
        >
          <mat-icon class="chip-icon">remove</mat-icon>
          Withdraw
        </button>
      </div>

      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Amount (₹)</mat-label>
          <input matInput type="number" min="1" formControlName="amount" />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('amount', 'Amount') }}</mat-error>
        </mat-form-field>
      </form>

      @if (mode() === 'add' && remaining() > 0) {
        <div class="quick-row">
          <span class="muted">Quick amounts:</span>
          @for (amount of quickAmounts(); track amount) {
            <button type="button" class="chip" (click)="setAmount(amount)">
              {{ amount | money }}
            </button>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button
        type="button"
        class="btn"
        [class.btn--primary]="mode() === 'add'"
        [class.btn--danger]="mode() === 'withdraw'"
        (click)="save()"
      >
        {{ mode() === 'add' ? 'Add to goal' : 'Withdraw' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 340px;
      }
      .summary {
        margin-bottom: var(--sp-4);
      }
      .mode-switch {
        display: flex;
        gap: var(--sp-2);
        margin-bottom: var(--sp-4);
      }
      .chip-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }
      .quick-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
        font-size: var(--fs-caption);
      }
    `,
  ],
})
export class ContributeDialogComponent {
  protected readonly data = inject<ContributeDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<ContributeDialogComponent, number>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly mode = signal<'add' | 'withdraw'>('add');

  protected readonly remaining = computed(() =>
    Math.max(0, this.data.goal.targetAmount - this.data.goal.savedAmount)
  );

  protected readonly form = this.fb.nonNullable.group({
    amount: [
      Math.round(Math.min(this.data.monthlyNeeded || 1000, this.remaining() || 1000)),
      [Validators.required, positiveNumber()],
    ],
  });

  /** Monthly contribution needed, a round figure, and the full remainder. */
  protected readonly quickAmounts = computed(() => {
    const remaining = this.remaining();
    const options = new Set<number>();
    if (this.data.monthlyNeeded >= 1) {
      options.add(Math.round(this.data.monthlyNeeded));
    }
    options.add(5000);
    if (remaining > 0) options.add(Math.round(remaining));
    return [...options].filter(a => a > 0 && a <= Math.max(remaining, 5000)).sort((a, b) => a - b);
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected setAmount(amount: number): void {
    this.form.controls.amount.setValue(amount);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const amount = Number(this.form.getRawValue().amount);
    this.ref.close(this.mode() === 'add' ? amount : -amount);
  }

  protected close(): void {
    this.ref.close();
  }
}
