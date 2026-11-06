import { Injectable, computed, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Goal, GoalStatus, getGoalStatus } from '../models/goal.model';
import { CollectionStore } from './collection.store';
import { AuthService } from './auth.service';
import { monthlySavingNeeded, monthsUntil } from '../../shared/utils/finance.utils';

/** A goal with its derived progress figures. */
export interface GoalProgress {
  goal: Goal;
  percent: number;
  remaining: number;
  monthlyNeeded: number;
  monthsLeft: number;
  status: GoalStatus;
  daysLeft: number;
}

/** Savings goals and their progress. */
@Injectable({ providedIn: 'root' })
export class GoalService extends CollectionStore<Goal> {
  protected readonly endpoint = '/goals';
  protected readonly storageKey = 'goals';

  private readonly auth = inject(AuthService);

  /** All goals with progress, unachieved and nearest-deadline first. */
  readonly progress = computed<GoalProgress[]>(() =>
    this.items()
      .map(goal => this.describe(goal))
      .sort((a, b) => {
        if (a.status === 'achieved' && b.status !== 'achieved') return 1;
        if (b.status === 'achieved' && a.status !== 'achieved') return -1;
        return a.daysLeft - b.daysLeft;
      })
  );

  /** Total saved across all goals — part of net worth. */
  readonly totalSaved = computed(() =>
    this.items().reduce((sum, g) => sum + g.savedAmount, 0)
  );

  readonly totalTarget = computed(() =>
    this.items().reduce((sum, g) => sum + g.targetAmount, 0)
  );

  readonly achievedCount = computed(
    () => this.progress().filter(p => p.status === 'achieved').length
  );

  /**
   * Months of expenses covered by the goal named like an emergency fund.
   * Feeds the emergency-fund component of the health score; returns 0 when no
   * such goal exists rather than guessing from total savings.
   */
  emergencyFundMonths(monthlyExpense: number): number {
    if (monthlyExpense <= 0) return 0;
    const fund = this.items().find(g => /emergency/i.test(g.name));
    if (!fund) return 0;
    return fund.savedAmount / monthlyExpense;
  }

  /** Derived figures for one goal. */
  describe(goal: Goal): GoalProgress {
    const percent =
      goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
    const daysLeft = Math.ceil(
      (new Date(goal.deadline).getTime() - Date.now()) / (24 * 3600 * 1000)
    );
    return {
      goal,
      percent,
      remaining: Math.max(0, goal.targetAmount - goal.savedAmount),
      monthlyNeeded: monthlySavingNeeded(
        goal.targetAmount,
        goal.savedAmount,
        goal.deadline
      ),
      monthsLeft: monthsUntil(goal.deadline),
      status: getGoalStatus(goal),
      daysLeft,
    };
  }

  /** Creates a goal for the current user. */
  add(
    draft: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'savedAmount'> &
      Partial<Pick<Goal, 'savedAmount'>>
  ): Observable<Goal> {
    return this.create({
      ...draft,
      savedAmount: draft.savedAmount ?? 0,
      userId: this.auth.userId(),
      createdAt: new Date().toISOString(),
    });
  }

  /** Adds money to a goal (or withdraws it with a negative amount). */
  contribute(id: string, amount: number): Observable<Goal> {
    const goal = this.find(id);
    if (!goal) return throwError(() => new Error('Goal not found.'));
    const savedAmount = Math.max(0, goal.savedAmount + amount);
    return this.patch(id, { savedAmount });
  }
}
