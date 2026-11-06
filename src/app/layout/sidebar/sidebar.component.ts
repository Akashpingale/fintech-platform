import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationCenterService } from '../../core/services/notification-center.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

/**
 * Primary navigation. On screens narrower than 768px this becomes a
 * horizontally scrollable bottom bar (see the component stylesheet).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
  ],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <div class="sidebar__logo">
        @if (!collapsed()) {
          <span class="logo-text">FinTrack</span>
        } @else {
          <span class="logo-icon">FT</span>
        }
      </div>

      <button
        type="button"
        class="collapse-btn desktop-only"
        (click)="toggleCollapse.emit()"
        [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
      </button>

      <nav class="nav-list" aria-label="Main navigation">
        @for (item of navItems; track item.route) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="active"
            [matTooltip]="collapsed() ? item.label : ''"
            matTooltipPosition="right"
          >
            <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
            @if (!collapsed()) {
              <span class="nav-label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <div class="flex-spacer"></div>

      <div class="nav-bottom">
        <a
          class="nav-item"
          routerLink="/settings"
          routerLinkActive="active"
          [matTooltip]="collapsed() ? 'Settings' : ''"
          matTooltipPosition="right"
        >
          <mat-icon class="nav-icon">settings</mat-icon>
          @if (!collapsed()) { <span class="nav-label">Settings</span> }
        </a>
        <a
          class="nav-item"
          routerLink="/notifications"
          routerLinkActive="active"
          [matTooltip]="collapsed() ? 'Notifications' : ''"
          matTooltipPosition="right"
        >
          <mat-icon
            class="nav-icon"
            [matBadge]="unread() > 9 ? '9+' : unread()"
            [matBadgeHidden]="unread() === 0"
            matBadgeColor="warn"
            matBadgeSize="small"
            >notifications</mat-icon
          >
          @if (!collapsed()) { <span class="nav-label">Notifications</span> }
        </a>
      </div>
    </aside>
  `,
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly toggleCollapse = output<void>();

  private readonly notifications = inject(NotificationCenterService);
  protected readonly unread = computed(() => this.notifications.unreadCount());

  protected readonly navItems: readonly NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Transactions', icon: 'swap_horiz', route: '/transactions' },
    { label: 'Budgets', icon: 'account_balance_wallet', route: '/budgets' },
    { label: 'Goals', icon: 'flag', route: '/goals' },
    { label: 'Portfolio', icon: 'trending_up', route: '/portfolio' },
    { label: 'Watchlist', icon: 'visibility', route: '/watchlist' },
    { label: 'SIP', icon: 'autorenew', route: '/sip' },
    { label: 'Calculators', icon: 'calculate', route: '/calculators' },
    { label: 'Analytics', icon: 'bar_chart', route: '/analytics' },
    { label: 'Reports', icon: 'description', route: '/reports' },
  ];
}
