import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { Sip } from '../../core/models/sip.model';
import { calculateSip } from '../../shared/utils/calculator.utils';
import {
  firstErrorMessage,
  notInFuture,
  positiveNumber,
} from '../../shared/validators/app.validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export interface SipDialogData {
  sip?: Sip;
}

export interface SipDialogResult {
  fundName: string;
  amount: number;
  dayOfMonth: number;
  startDate: string;
  durationMonths: number;
  expectedReturn: number;
}

/** Create or edit a systematic investment plan, with a live projection. */
@Component({
  selector: 'app-sip-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSliderModule,
    MoneyPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.sip ? 'Edit SIP' : 'New SIP' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline" class="form-row-full">
          <mat-label>Fund name</mat-label>
          <input
            matInput
            formControlName="fundName"
            placeholder="e.g. Parag Parikh Flexi Cap Fund"
          />
          <mat-icon matPrefix>savings</mat-icon>
          <mat-error>{{ errorFor('fundName', 'Fund name') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Monthly amount (₹)</mat-label>
          <input matInput type="number" min="500" formControlName="amount" />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('amount', 'Amount') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Debit day of month</mat-label>
          <mat-select formControlName="dayOfMonth">
            @for (day of days; track day) {
              <mat-option [value]="day">{{ day }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Start date</mat-label>
          <input matInput type="date" formControlName="startDate" />
          <mat-error>{{ errorFor('startDate', 'Start date') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Duration (months)</mat-label>
          <input
            matInput
            type="number"
            min="1"
            max="600"
            formControlName="durationMonths"
          />
          <mat-error>{{ errorFor('durationMonths', 'Duration') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="form-row-full">
          <mat-label>Expected annual return (%)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            max="40"
            step="0.5"
            formControlName="expectedReturn"
          />
          <mat-hint>
            A long-term equity fund has historically returned 10–14% a year.
            This is an assumption, not a guarantee.
          </mat-hint>
        </mat-form-field>
      </form>

      <div class="projection">
        <div class="kv">
          <span class="kv__key">You will invest</span>
          <span class="kv__value">{{ projection().invested | money }}</span>
        </div>
        <div class="kv">
          <span class="kv__key">Projected value at maturity</span>
          <span class="kv__value gain">{{ projection().value | money }}</span>
        </div>
        <div class="kv">
          <span class="kv__key">Expected gain</span>
          <span class="kv__value">{{ projection().gain | money }}</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button type="button" class="btn btn--primary" (click)="save()">
        {{ data.sip ? 'Save SIP' : 'Create SIP' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: min(540px, 80vw);
      }
      .projection {
        margin-top: var(--sp-4);
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-md);
        background: var(--surface-2);
      }
    `,
  ],
})
export class SipDialogComponent {
  protected readonly data = inject<SipDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<SipDialogComponent, SipDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly days = Array.from({ length: 28 }, (_, i) => i + 1);

  protected readonly form = this.fb.nonNullable.group({
    fundName: [
      this.data.sip?.fundName ?? '',
      [Validators.required, Validators.maxLength(64)],
    ],
    amount: [this.data.sip?.amount ?? 5000, [Validators.required, positiveNumber()]],
    dayOfMonth: [this.data.sip?.dayOfMonth ?? 5, Validators.required],
    startDate: [
      this.data.sip?.startDate.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      [Validators.required, notInFuture()],
    ],
    durationMonths: [
      this.data.sip?.durationMonths ?? 60,
      [Validators.required, positiveNumber(), Validators.max(600)],
    ],
    expectedReturn: [
      this.data.sip?.expectedReturn ?? 12,
      [Validators.required, Validators.min(0), Validators.max(40)],
    ],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Live maturity projection from the current form values. */
  protected readonly projection = computed(() => {
    const value = this.values();
    const amount = Number(value?.amount ?? 0);
    const months = Number(value?.durationMonths ?? 0);
    const rate = Number(value?.expectedReturn ?? 0);
    if (amount <= 0 || months <= 0) {
      return { invested: 0, value: 0, gain: 0 };
    }
    const result = calculateSip(amount, rate, months / 12);
    return {
      invested: amount * months,
      value: result.futureValue,
      gain: result.futureValue - amount * months,
    };
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.ref.close({
      fundName: value.fundName.trim(),
      amount: Number(value.amount),
      dayOfMonth: Number(value.dayOfMonth),
      startDate: value.startDate,
      durationMonths: Number(value.durationMonths),
      expectedReturn: Number(value.expectedReturn),
    });
  }

  protected close(): void {
    this.ref.close();
  }
}
