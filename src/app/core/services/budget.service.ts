import { Injectable, computed, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { Budget, BudgetStatus, getBudgetStatus } from '../models/budget.model';
import { CollectionStore } from './collection.store';
import { AuthService } from './auth.service';
import { TransactionService } from './transaction.service';
import {
  budgetAdherence,
  budgetUsage,
  monthKey,
} from '../../shared/utils/finance.utils';

/** A budget joined with the spend actually recorded against it. */
export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  usage: number;
  status: BudgetStatus;
}

/** Monthly category budgets and their progress against real spend. */
@Injectable({ providedIn: 'root' })
export class BudgetService extends CollectionStore<Budget> {
  protected readonly endpoint = '/budgets';
  protected readonly storageKey = 'budgets';

  private readonly auth = inject(AuthService);
  private readonly transactions = inject(TransactionService);

  /** Budgets for the current month, joined with spend. */
  readonly currentMonthProgress = computed(() =>
    this.progressFor(monthKey())
  );

  readonly totalLimit = computed(() =>
    this.currentMonthProgress().reduce((sum, p) => sum + p.budget.limit, 0)
  );

  readonly totalSpent = computed(() =>
    this.currentMonthProgress().reduce((sum, p) => sum + p.spent, 0)
  );

  /** Budget adherence 0–100 for the health score. */
  readonly adherence = computed(() =>
    budgetAdherence(
      this.currentMonthProgress().map(p => ({
        spent: p.spent,
        limit: p.budget.limit,
      }))
    )
  );

  /** Categories at or past 80% of their limit — drives alerts. */
  readonly alerts = computed(() =>
    this.currentMonthProgress()
      .filter(p => p.usage >= 80)
      .sort((a, b) => b.usage - a.usage)
  );

  /** Budgets for a `YYYY-MM` month, joined with spend, largest usage first. */
  progressFor(month: string): BudgetProgress[] {
    return this.items()
      .filter(b => b.month === month)
      .map(budget => {
        const spent = this.transactions.spentInCategory(budget.category, month);
        const usage = budgetUsage(spent, budget.limit);
        return {
          budget,
          spent,
          remaining: budget.limit - spent,
          usage,
          status: getBudgetStatus(spent, budget.limit),
        };
      })
      .sort((a, b) => b.usage - a.usage);
  }

  /** Months that have at least one budget, newest first. */
  readonly months = computed(() =>
    [...new Set(this.items().map(b => b.month))].sort().reverse()
  );

  /** Adds or updates the limit for a category in a month (one budget each). */
  setLimit(
    category: string,
    month: string,
    limit: number
  ): Observable<Budget> {
    const existing = this.items().find(
      b => b.category === category && b.month === month
    );
    if (existing) {
      return this.patch(existing.id, { limit });
    }
    return this.create({
      userId: this.auth.userId(),
      category,
      month,
      limit,
    });
  }

  /**
   * Copies every budget from `fromMonth` into `toMonth`, skipping categories
   * that already have a budget there, and reports how many were copied.
   */
  copyMonth(fromMonth: string, toMonth: string): Observable<number> {
    const source = this.items().filter(b => b.month === fromMonth);
    const existing = new Set(
      this.items().filter(b => b.month === toMonth).map(b => b.category)
    );
    const drafts = source
      .filter(b => !existing.has(b.category))
      .map(b => ({
        userId: b.userId,
        category: b.category,
        month: toMonth,
        limit: b.limit,
      }));

    if (drafts.length === 0) return of(0);
    return this.createMany(drafts).pipe(map(created => created.length));
  }

  /** The previous calendar month key relative to `month`. */
  previousMonth(month = monthKey()): string {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(year, (m ?? 1) - 2, 1);
    return monthKey(date);
  }
}
