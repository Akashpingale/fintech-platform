import { Component, computed, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AppNotification } from '../../core/models/notification.model';
import {
  NOTIFICATION_META,
  NotificationCenterService,
} from '../../core/services/notification-center.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

type Filter = 'all' | 'unread' | AppNotification['type'];

/**
 * Notification centre — Section 3.11.
 * Budget, goal, SIP and price alerts generated from the live state of the
 * other modules.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    RouterLink,
    LowerCasePipe,
    MatIconModule,
    MatTooltipModule,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    TimeAgoPipe,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);

  protected readonly notifications = inject(NotificationCenterService);

  protected readonly meta = NOTIFICATION_META;
  protected readonly filter = signal<Filter>('all');
  protected readonly refreshing = signal(false);

  protected readonly filters: { value: Filter; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'inbox' },
    { value: 'unread', label: 'Unread', icon: 'mark_email_unread' },
    { value: 'budget', label: 'Budgets', icon: 'account_balance_wallet' },
    { value: 'goal', label: 'Goals', icon: 'flag' },
    { value: 'sip', label: 'SIP', icon: 'autorenew' },
    { value: 'price', label: 'Price alerts', icon: 'trending_up' },
  ];

  protected readonly loading = computed(() => !this.notifications.loaded());

  protected readonly rows = computed(() => {
    const all = this.notifications.sorted();
    const filter = this.filter();
    if (filter === 'all') return all;
    if (filter === 'unread') return all.filter(n => !n.read);
    return all.filter(n => n.type === filter);
  });

  protected readonly unreadCount = computed(() => this.notifications.unreadCount());

  /** Count per filter, for the chip labels. */
  protected countFor(filter: Filter): number {
    const all = this.notifications.sorted();
    if (filter === 'all') return all.length;
    if (filter === 'unread') return all.filter(n => !n.read).length;
    return all.filter(n => n.type === filter).length;
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected markRead(notification: AppNotification): void {
    if (notification.read) return;
    this.notifications.markRead(notification.id).subscribe();
  }

  protected markAllRead(): void {
    if (this.unreadCount() === 0) return;
    this.notifications.markAllRead().subscribe(() => {
      this.toast.success('All notifications marked as read.');
    });
  }

  protected remove(notification: AppNotification): void {
    this.notifications.remove(notification.id).subscribe();
  }

  protected clearAll(): void {
    if (this.notifications.items().length === 0) return;

    confirmAction(this.dialog, {
      title: 'Clear every notification?',
      message:
        'The list will be emptied. Alerts regenerate from your current budgets, goals, SIPs and price triggers.',
      confirmLabel: 'Clear all',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.notifications.clearAll().subscribe(() => {
        this.toast.success('Notifications cleared.');
      });
    });
  }

  protected refresh(): void {
    this.refreshing.set(true);
    this.notifications.refreshAlerts().subscribe({
      next: created => {
        this.refreshing.set(false);
        this.toast.success(
          created === 0
            ? 'No new alerts — everything is already up to date.'
            : `${created} new alert${created === 1 ? '' : 's'} raised.`
        );
      },
      error: () => {
        this.refreshing.set(false);
        this.toast.error('Could not refresh alerts.');
      },
    });
  }

  /** Where clicking a notification should take the user. */
  protected linkFor(notification: AppNotification): string {
    switch (notification.type) {
      case 'budget':
        return '/budgets';
      case 'goal':
        return '/goals';
      case 'sip':
        return '/sip';
      default:
        return '/watchlist';
    }
  }
}
