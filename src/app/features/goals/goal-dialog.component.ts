import { Component, inject } from '@angular/core';
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
  futureDate,
  nonNegativeNumber,
  positiveNumber,
} from '../../shared/validators/app.validators';

export interface GoalDialogData {
  goal?: Goal;
}

export interface GoalDialogResult {
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
}

/** Create or edit a savings goal. */
@Component({
  selector: 'app-goal-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.goal ? 'Edit goal' : 'New savings goal' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Goal name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Emergency Fund" />
          <mat-icon matPrefix>flag</mat-icon>
          <mat-error>{{ errorFor('name', 'Name') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Target amount (₹)</mat-label>
          <input matInput type="number" min="1" formControlName="targetAmount" />
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <mat-error>{{ errorFor('targetAmount', 'Target amount') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Already saved (₹)</mat-label>
          <input matInput type="number" min="0" formControlName="savedAmount" />
          <mat-error>{{ errorFor('savedAmount', 'Saved amount') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Target date</mat-label>
          <input matInput type="date" formControlName="deadline" />
          <mat-error>{{ errorFor('deadline', 'Target date') }}</mat-error>
        </mat-form-field>
      </form>

      <p class="hint muted">
        Name a goal "Emergency Fund" and FinTrack counts it towards the
        emergency-fund part of your health score.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
      <button type="button" class="btn btn--primary" (click)="save()">
        {{ data.goal ? 'Save goal' : 'Create goal' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 340px;
      }
      .hint {
        font-size: var(--fs-caption);
        margin: var(--sp-3) 0 0;
      }
    `,
  ],
})
export class GoalDialogComponent {
  protected readonly data = inject<GoalDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<GoalDialogComponent, GoalDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    name: [
      this.data.goal?.name ?? '',
      [Validators.required, Validators.maxLength(48)],
    ],
    targetAmount: [
      this.data.goal?.targetAmount ?? 100000,
      [Validators.required, positiveNumber()],
    ],
    savedAmount: [
      this.data.goal?.savedAmount ?? 0,
      [Validators.required, nonNegativeNumber()],
    ],
    deadline: [
      this.data.goal?.deadline.slice(0, 10) ?? this.defaultDeadline(),
      // Editing an existing goal may legitimately have a past deadline, so the
      // future-date rule only applies when creating one.
      this.data.goal ? [Validators.required] : [Validators.required, futureDate()],
    ],
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
      name: value.name.trim(),
      targetAmount: Number(value.targetAmount),
      savedAmount: Number(value.savedAmount),
      deadline: value.deadline,
    });
  }

  protected close(): void {
    this.ref.close();
  }

  /** One year out, as a sensible starting deadline. */
  private defaultDeadline(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }
}
