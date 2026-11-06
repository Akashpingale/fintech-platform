import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AssetType, Holding } from '../../core/models/holding.model';
import {
  ASSET_TYPE_ICONS,
  ASSET_TYPE_LABELS,
} from '../../core/services/portfolio.service';
import {
  firstErrorMessage,
  nonNegativeNumber,
  notInFuture,
  positiveNumber,
} from '../../shared/validators/app.validators';

export interface HoldingDialogData {
  holding?: Holding;
}

export interface HoldingDialogResult {
  assetType: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
  fees: number;
}

/** Add a new holding, or edit the identifying details of an existing one. */
@Component({
  selector: 'app-holding-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.holding ? 'Edit holding' : 'Add a holding' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline" class="form-row-full">
          <mat-label>Asset type</mat-label>
          <mat-select formControlName="assetType">
            @for (type of assetTypes; track type) {
              <mat-option [value]="type">
                <mat-icon class="option-icon">{{ icons[type] }}</mat-icon>
                {{ labels[type] }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Symbol / code</mat-label>
          <input
            matInput
            formControlName="symbol"
            placeholder="RELIANCE"
            style="text-transform: uppercase"
          />
          <mat-error>{{ errorFor('symbol', 'Symbol') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Reliance Industries"
          />
          <mat-error>{{ errorFor('name', 'Name') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Quantity / units</mat-label>
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
          <mat-label>Buy price per unit (₹)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="0.01"
            formControlName="avgBuyPrice"
          />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('avgBuyPrice', 'Buy price') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Buy date</mat-label>
          <input matInput type="date" formControlName="buyDate" />
          <mat-error>{{ errorFor('buyDate', 'Buy date') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Brokerage &amp; fees (₹)</mat-label>
          <input matInput type="number" min="0" step="0.01" formControlName="fees" />
          <mat-error>{{ errorFor('fees', 'Fees') }}</mat-error>
        </mat-form-field>
      </form>

      <p class="hint muted">
        For a fixed deposit or a lump-sum bond, enter quantity 1 and the
        invested amount as the buy price.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button type="button" class="btn btn--primary" (click)="save()">
        {{ data.holding ? 'Save holding' : 'Add holding' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: min(560px, 80vw);
      }
      .option-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        margin-right: var(--sp-2);
        vertical-align: middle;
        color: var(--text-muted);
      }
      .hint {
        font-size: var(--fs-caption);
        margin: var(--sp-3) 0 0;
      }
    `,
  ],
})
export class HoldingDialogComponent {
  protected readonly data = inject<HoldingDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<HoldingDialogComponent, HoldingDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly labels = ASSET_TYPE_LABELS;
  protected readonly icons = ASSET_TYPE_ICONS;
  protected readonly assetTypes = Object.keys(ASSET_TYPE_LABELS) as AssetType[];

  protected readonly form = this.fb.nonNullable.group({
    assetType: [this.data.holding?.assetType ?? ('stock' as AssetType), Validators.required],
    symbol: [
      this.data.holding?.symbol ?? '',
      [Validators.required, Validators.maxLength(16)],
    ],
    name: [
      this.data.holding?.name ?? '',
      [Validators.required, Validators.maxLength(64)],
    ],
    quantity: [
      this.data.holding?.quantity ?? 1,
      [Validators.required, positiveNumber()],
    ],
    avgBuyPrice: [
      this.data.holding?.avgBuyPrice ?? 0,
      [Validators.required, positiveNumber()],
    ],
    buyDate: [
      this.data.holding?.buyDate.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      [Validators.required, notInFuture()],
    ],
    fees: [0, [nonNegativeNumber()]],
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
      assetType: value.assetType,
      symbol: value.symbol.trim().toUpperCase(),
      name: value.name.trim(),
      quantity: Number(value.quantity),
      avgBuyPrice: Number(value.avgBuyPrice),
      buyDate: value.buyDate,
      fees: Number(value.fees),
    });
  }

  protected close(): void {
    this.ref.close();
  }
}
