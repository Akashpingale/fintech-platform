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
import { EXPENSE_CATEGORIES } from '../../core/models/transaction.model';
import {
  firstErrorMessage,
  positiveNumber,
} from '../../shared/validators/app.validators';
import { categoryIcon } from '../../shared/utils/category-icons';
import { monthLabel } from '../../shared/utils/finance.utils';

export interface BudgetDialogData {
  month: string;
  /** Set when editing an existing budget. */
  category?: string;
  limit?: number;
  /** Categories that already have a budget this month. */
  taken: readonly string[];
}

export interface BudgetDialogResult {
  category: string;
  limit: number;
}

/** Create or edit a single category budget. */
@Component({
  selector: 'app-budget-dialog',
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
      {{ data.category ? 'Edit budget' : 'Add a budget' }}
    </h2>

    <mat-dialog-content>
      <p class="muted dialog-sub">
        Monthly limit for {{ monthName }}.
      </p>

      <form [formGroup]="form" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            @for (category of available; track category) {
              <mat-option [value]="category">
                <mat-icon class="option-icon">{{ iconFor(category) }}</mat-icon>
                {{ category }}
              </mat-option>
            }
          </mat-select>
          <mat-error>{{ errorFor('category', 'Category') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Monthly limit (₹)</mat-label>
          <input matInput type="number" min="1" formControlName="limit" />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('limit', 'Limit') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button type="button" class="btn btn--primary" (click)="save()">
        {{ data.category ? 'Save limit' : 'Add budget' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-sub {
        margin: 0 0 var(--sp-4);
      }
      .option-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        margin-right: var(--sp-2);
        vertical-align: middle;
        color: var(--text-muted);
      }
      mat-dialog-content {
        min-width: 320px;
      }
    `,
  ],
})
export class BudgetDialogComponent {
  protected readonly data = inject<BudgetDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<BudgetDialogComponent, BudgetDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly monthName = monthLabel(this.data.month);

  /** Existing budgets are excluded, except the one being edited. */
  protected readonly available = EXPENSE_CATEGORIES.filter(
    category =>
      category === this.data.category || !this.data.taken.includes(category)
  );

  protected readonly form = this.fb.nonNullable.group({
    category: [this.data.category ?? '', Validators.required],
    limit: [this.data.limit ?? 5000, [Validators.required, positiveNumber()]],
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected iconFor(category: string): string {
    return categoryIcon(category);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { category, limit } = this.form.getRawValue();
    this.ref.close({ category, limit: Number(limit) });
  }

  protected close(): void {
    this.ref.close();
  }
}
