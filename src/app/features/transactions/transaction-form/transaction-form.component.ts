import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Transaction,
} from '../../../core/models/transaction.model';
import { TransactionService } from '../../../core/services/transaction.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  firstErrorMessage,
  notInFuture,
  positiveNumber,
} from '../../../shared/validators/app.validators';
import { categoryIcon } from '../../../shared/utils/category-icons';

/**
 * Add/edit transaction form — Section 3.3.
 *
 * The route supplies `id` through `withComponentInputBinding()`; when it is
 * present the form loads that record, otherwise it creates a new one.
 */
@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss',
})
export class TransactionFormComponent {
  /** Bound from the `:id` route parameter. */
  readonly id = input<string | undefined>();

  private readonly fb = inject(FormBuilder);
  private readonly transactions = inject(TransactionService);
  private readonly toast = inject(NotificationService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly tags = signal<string[]>([]);
  protected readonly notFound = signal(false);

  protected readonly paymentMethods = [
    { value: 'upi', label: 'UPI', icon: 'qr_code_2' },
    { value: 'card', label: 'Card', icon: 'credit_card' },
    { value: 'cash', label: 'Cash', icon: 'payments' },
    { value: 'bank', label: 'Bank transfer', icon: 'account_balance' },
  ] as const;

  protected readonly form = this.fb.nonNullable.group({
    type: ['expense' as 'income' | 'expense', Validators.required],
    amount: [0, [Validators.required, positiveNumber()]],
    category: ['', Validators.required],
    date: [new Date().toISOString().slice(0, 10), [Validators.required, notInFuture()]],
    paymentMethod: ['upi' as Transaction['paymentMethod'], Validators.required],
    notes: ['', Validators.maxLength(160)],
    isRecurring: [false],
    frequency: ['monthly' as 'weekly' | 'monthly' | 'yearly'],
    recurringEndDate: [''],
  });

  /** Live value of the type toggle, so the category list can follow it. */
  private readonly typeValue = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  private readonly recurringValue = toSignal(
    this.form.controls.isRecurring.valueChanges,
    { initialValue: false }
  );

  protected readonly isEdit = computed(() => Boolean(this.id()));

  protected readonly categories = computed(() =>
    this.typeValue() === 'income'
      ? [...INCOME_CATEGORIES]
      : [...EXPENSE_CATEGORIES]
  );

  protected readonly showRecurring = computed(() => this.recurringValue());

  constructor() {
    // Load the record being edited once the collection is available.
    effect(() => {
      const id = this.id();
      if (!id || !this.transactions.loaded()) return;

      const existing = this.transactions.find(id);
      if (!existing) {
        this.notFound.set(true);
        return;
      }
      this.notFound.set(false);
      this.form.patchValue({
        type: existing.type,
        amount: existing.amount,
        category: existing.category,
        date: existing.date.slice(0, 10),
        paymentMethod: existing.paymentMethod,
        notes: existing.notes ?? '',
        isRecurring: Boolean(existing.recurring),
        frequency: existing.recurring?.frequency ?? 'monthly',
        recurringEndDate: existing.recurring?.endDate?.slice(0, 10) ?? '',
      });
      this.tags.set([...(existing.tags ?? [])]);
    });

    // Clear a category that does not belong to the newly selected type.
    effect(() => {
      const valid = this.categories();
      const current = this.form.controls.category.value;
      if (current && !valid.includes(current as never)) {
        this.form.controls.category.setValue('');
      }
    });
  }

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected iconFor(category: string): string {
    return categoryIcon(category);
  }

  protected addTag(event: MatChipInputEvent): void {
    const value = event.value.trim().toLowerCase();
    if (value && !this.tags().includes(value) && this.tags().length < 8) {
      this.tags.update(list => [...list, value]);
    }
    event.chipInput.clear();
  }

  protected removeTag(tag: string): void {
    this.tags.update(list => list.filter(t => t !== tag));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields.');
      return;
    }

    const value = this.form.getRawValue();
    const recurring = value.isRecurring
      ? {
          frequency: value.frequency,
          ...(value.recurringEndDate
            ? { endDate: value.recurringEndDate }
            : {}),
        }
      : undefined;

    const payload: Omit<Transaction, 'id'> = {
      userId: this.auth.userId(),
      type: value.type,
      amount: Number(value.amount),
      category: value.category,
      date: value.date,
      paymentMethod: value.paymentMethod,
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      ...(this.tags().length ? { tags: this.tags() } : {}),
      ...(recurring ? { recurring } : {}),
    };

    this.busy.set(true);
    const id = this.id();
    const request = id
      ? this.transactions.update({ ...payload, id })
      : this.transactions.create(payload);

    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(
          id ? 'Transaction updated.' : 'Transaction added.'
        );
        // Spending may have pushed a budget past its threshold.
        this.notifications.refreshAlerts().subscribe();
        void this.router.navigate(['/transactions']);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Could not save the transaction.');
      },
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/transactions']);
  }
}
