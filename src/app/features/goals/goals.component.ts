import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { GoalProgress, GoalService } from '../../core/services/goal.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring/progress-ring.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  GoalDialogComponent,
  GoalDialogResult,
} from './goal-dialog.component';
import { ContributeDialogComponent } from './contribute-dialog.component';

/**
 * Savings goals — Section 3.5.
 * Progress rings, deadline countdown, the monthly contribution needed, and
 * add/withdraw actions.
 */
@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    StatCardComponent,
    ProgressRingComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss',
})
export class GoalsComponent {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);
  private readonly notifications = inject(NotificationCenterService);

  protected readonly goals = inject(GoalService);

  /** Goals that just hit 100%, so the card can celebrate once. */
  protected readonly celebrating = signal<ReadonlySet<string>>(new Set());

  /** Indices driving the confetti animation's per-piece CSS variable. */
  protected readonly confettiPieces = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  protected readonly loading = computed(() => !this.goals.loaded());
  protected readonly progress = computed(() => this.goals.progress());

  protected readonly summary = computed(() => {
    const rows = this.progress();
    return {
      saved: this.goals.totalSaved(),
      target: this.goals.totalTarget(),
      achieved: rows.filter(r => r.status === 'achieved').length,
      behind: rows.filter(r => r.status === 'behind').length,
      monthlyNeeded: rows
        .filter(r => r.status !== 'achieved')
        .reduce((sum, r) => sum + r.monthlyNeeded, 0),
    };
  });

  protected create(): void {
    this.dialog
      .open(GoalDialogComponent, { width: '460px', data: {} })
      .afterClosed()
      .subscribe((result: GoalDialogResult | undefined) => {
        if (!result) return;
        this.goals.add(result).subscribe(() => {
          this.toast.success(`Goal "${result.name}" created.`);
        });
      });
  }

  protected edit(row: GoalProgress): void {
    this.dialog
      .open(GoalDialogComponent, {
        width: '460px',
        data: { goal: row.goal },
      })
      .afterClosed()
      .subscribe((result: GoalDialogResult | undefined) => {
        if (!result) return;
        this.goals
          .update({ ...row.goal, ...result })
          .subscribe(() => this.toast.success('Goal updated.'));
      });
  }

  protected contribute(row: GoalProgress): void {
    this.dialog
      .open(ContributeDialogComponent, {
        width: '440px',
        data: { goal: row.goal, monthlyNeeded: row.monthlyNeeded },
      })
      .afterClosed()
      .subscribe((amount: number | undefined) => {
        if (!amount) return;

        this.goals.contribute(row.goal.id, amount).subscribe(updated => {
          if (amount > 0) {
            this.toast.success(
              `Added ${this.formatSigned(amount)} to ${row.goal.name}.`
            );
          } else {
            this.toast.info(
              `Withdrew ${this.formatSigned(-amount)} from ${row.goal.name}.`
            );
          }

          const nowComplete =
            updated.savedAmount >= updated.targetAmount &&
            row.goal.savedAmount < row.goal.targetAmount;

          if (nowComplete) {
            this.celebrate(updated.id);
            this.notifications.refreshAlerts().subscribe();
          }
        });
      });
  }

  protected remove(row: GoalProgress): void {
    confirmAction(this.dialog, {
      title: `Delete "${row.goal.name}"?`,
      message: `The ${this.formatSigned(row.goal.savedAmount)} tracked against this goal will no longer count towards your net worth.`,
      confirmLabel: 'Delete goal',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.goals
        .remove(row.goal.id)
        .subscribe(() => this.toast.success('Goal deleted.'));
    });
  }

  protected isCelebrating(id: string): boolean {
    return this.celebrating().has(id);
  }

  /** Human countdown to the deadline. */
  protected deadlineLabel(row: GoalProgress): string {
    if (row.status === 'achieved') return 'Completed';
    if (row.daysLeft < 0) {
      return `${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? '' : 's'} overdue`;
    }
    if (row.daysLeft === 0) return 'Due today';
    if (row.daysLeft < 31) return `${row.daysLeft} days left`;
    const months = Math.round(row.monthsLeft);
    return `${months} month${months === 1 ? '' : 's'} left`;
  }

  protected statusLabel(row: GoalProgress): string {
    if (row.status === 'achieved') return 'Achieved';
    return row.status === 'on_track' ? 'On track' : 'Behind';
  }

  private celebrate(id: string): void {
    this.celebrating.update(set => new Set(set).add(id));
    // Keep the animation brief; the badge carries the lasting state.
    setTimeout(() => {
      this.celebrating.update(set => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }, 2400);
  }

  private formatSigned(value: number): string {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }
}
