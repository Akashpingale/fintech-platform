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
import { MatIconModule } from '@angular/material/icon';
import { Holding } from '../../core/models/holding.model';
import {
  firstErrorMessage,
  nonNegativeNumber,
  notInFuture,
  positiveNumber,
} from '../../shared/validators/app.validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export interface TradeDialogData {
  holding: Holding;
  side: 'buy' | 'sell';
  /** Live market price, used as the default. */
  marketPrice: number;
}

export interface TradeDialogResult {
  quantity: number;
  price: number;
  fees: number;
  date: string;
}

/** Record a buy or sell against an existing holding. */
@Component({
  selector: 'app-trade-dialog',
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
      {{ isSell ? 'Sell' : 'Buy more' }} · {{ data.holding.symbol }}
    </h2>

    <mat-dialog-content>
      <div class="summary">
        <div class="kv">
          <span class="kv__key">Holding</span>
          <span class="kv__value">
            {{ data.holding.quantity }} units @
            {{ data.holding.avgBuyPrice | money: 2 }}
          </span>
        </div>
        <div class="kv">
          <span class="kv__key">Market price</span>
          <span class="kv__value">{{ data.marketPrice | money: 2 }}</span>
        </div>
      </div>

      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Quantity</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="0.0001"
            formControlName="quantity"
          />
          <mat-error>{{ errorFor('quantity', 'Quantity') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Price per unit (₹)</mat-label>
          <input matInput type="number" min="0" step="0.01" formControlName="price" />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('price', 'Price') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fees (₹)</mat-label>
          <input matInput type="number" min="0" step="0.01" formControlName="fees" />
          <mat-error>{{ errorFor('fees', 'Fees') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="date" />
          <mat-error>{{ errorFor('date', 'Date') }}</mat-error>
        </mat-form-field>
      </form>

      @if (quantityError()) {
        <p class="trade-warning" role="alert">
          <mat-icon>error_outline</mat-icon>
          {{ quantityError() }}
        </p>
      }

      <div class="preview">
        <div class="kv">
          <span class="kv__key">
            {{ isSell ? 'Proceeds after fees' : 'Total outlay' }}
          </span>
          <span class="kv__value">{{ netAmount() | money }}</span>
        </div>
        @if (isSell) {
          <div class="kv">
            <span class="kv__key">Realised P/L</span>
            <span
              class="kv__value"
              [class.gain]="realised() >= 0"
              [class.loss]="realised() < 0"
              >{{ realised() | money }}</span
            >
          </div>
          <div class="kv">
            <span class="kv__key">Units left</span>
            <span class="kv__value">{{ unitsLeft() }}</span>
          </div>
        } @else {
          <div class="kv">
            <span class="kv__key">New average cost</span>
            <span class="kv__value">{{ newAverage() | money: 2 }}</span>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button
        type="button"
        class="btn"
        [class.btn--danger]="isSell"
        [class.btn--primary]="!isSell"
        [disabled]="quantityError() !== ''"
        (click)="save()"
      >
        {{ isSell ? 'Record sale' : 'Record purchase' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: min(520px, 80vw);
      }
      .summary {
        margin-bottom: var(--sp-4);
      }
      .preview {
        margin-top: var(--sp-4);
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-md);
        background: var(--surface-2);
      }
      .trade-warning {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        margin: var(--sp-2) 0 0;
        padding: var(--sp-3);
        border-radius: var(--r-sm);
        background: var(--danger-soft);
        color: var(--danger);
        font-size: 0.875rem;
        font-weight: 500;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    `,
  ],
})
export class TradeDialogComponent {
  protected readonly data = inject<TradeDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<TradeDialogComponent, TradeDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly isSell = this.data.side === 'sell';

  protected readonly form = this.fb.nonNullable.group({
    quantity: [
      this.isSell ? this.data.holding.quantity : 1,
      [Validators.required, positiveNumber()],
    ],
    price: [
      Number(this.data.marketPrice.toFixed(2)),
      [Validators.required, positiveNumber()],
    ],
    fees: [0, [nonNegativeNumber()]],
    date: [
      new Date().toISOString().slice(0, 10),
      [Validators.required, notInFuture()],
    ],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly quantity = computed(() =>
    Number(this.values()?.quantity ?? 0)
  );
  private readonly price = computed(() => Number(this.values()?.price ?? 0));
  private readonly fees = computed(() => Number(this.values()?.fees ?? 0));

  /** Blocks a sale larger than the position. */
  protected readonly quantityError = computed(() => {
    if (!this.isSell) return '';
    const quantity = this.quantity();
    if (quantity > this.data.holding.quantity) {
      return `You only hold ${this.data.holding.quantity} units of ${this.data.holding.symbol}.`;
    }
    return '';
  });

  protected readonly netAmount = computed(() => {
    const gross = this.quantity() * this.price();
    return this.isSell ? gross - this.fees() : gross + this.fees();
  });

  protected readonly realised = computed(
    () =>
      (this.price() - this.data.holding.avgBuyPrice) * this.quantity() -
      this.fees()
  );

  protected readonly unitsLeft = computed(() =>
    Number((this.data.holding.quantity - this.quantity()).toFixed(4))
  );

  protected readonly newAverage = computed(() => {
    const totalQty = this.data.holding.quantity + this.quantity();
    if (totalQty <= 0) return this.data.holding.avgBuyPrice;
    return (
      (this.data.holding.avgBuyPrice * this.data.holding.quantity +
        this.price() * this.quantity()) /
      totalQty
    );
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected save(): void {
    if (this.form.invalid || this.quantityError()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.ref.close({
      quantity: Number(value.quantity),
      price: Number(value.price),
      fees: Number(value.fees),
      date: value.date,
    });
  }

  protected close(): void {
    this.ref.close();
  }
}
