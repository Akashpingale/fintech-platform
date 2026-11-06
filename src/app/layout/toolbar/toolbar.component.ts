import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { MarketDataService } from '../../core/services/market-data.service';

/**
 * Top toolbar: sidebar toggle, page title, live-price indicator, theme toggle,
 * notification bell with unread count, and the user menu.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  template: `
    <header class="toolbar">
      <div class="toolbar-left">
        <button
          mat-icon-button
          (click)="toggleSidebar.emit()"
          [attr.aria-expanded]="!sidebarCollapsed()"
          aria-label="Toggle navigation sidebar"
        >
          <mat-icon>menu</mat-icon>
        </button>
        <span class="page-title">{{ pageTitle() }}</span>
      </div>

      <div class="toolbar-right">
        @if (market.isLive()) {
          <span
            class="live-pill"
            [matTooltip]="
              market.cryptoLive()
                ? 'Simulated prices; crypto from CoinGecko'
                : 'Simulated live prices'
            "
          >
            <span class="live-dot"></span>
            Live
          </span>
        }

        <button
          mat-icon-button
          (click)="theme.toggle()"
          [matTooltip]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <mat-icon class="theme-icon">{{
            theme.isDark() ? 'light_mode' : 'dark_mode'
          }}</mat-icon>
        </button>

        <button
          mat-icon-button
          routerLink="/notifications"
          matTooltip="Notifications"
          [attr.aria-label]="
            unread() > 0 ? unread() + ' unread notifications' : 'Notifications'
          "
        >
          <mat-icon
            [matBadge]="unread() > 9 ? '9+' : unread()"
            [matBadgeHidden]="unread() === 0"
            matBadgeColor="warn"
            matBadgeSize="small"
            >notifications</mat-icon
          >
        </button>

        @if (user()) {
          <button
            mat-icon-button
            [matMenuTriggerFor]="userMenu"
            aria-label="Account menu"
          >
            <span class="avatar">{{ auth.initials() }}</span>
          </button>

          <mat-menu #userMenu="matMenu">
            <div class="menu-head">
              <div class="menu-name">{{ user()!.name }}</div>
              <div class="menu-email">{{ user()!.email }}</div>
            </div>
            <mat-divider />
            <button mat-menu-item routerLink="/settings">
              <mat-icon>person</mat-icon>
              <span>Profile &amp; settings</span>
            </button>
            <button mat-menu-item routerLink="/reports">
              <mat-icon>description</mat-icon>
              <span>Reports</span>
            </button>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        } @else {
          <a class="btn btn--primary btn--sm" routerLink="/auth/login">Sign in</a>
        }
      </div>
    </header>
  `,
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {
  readonly sidebarCollapsed = input(false);
  readonly pageTitle = input('Dashboard');
  readonly toggleSidebar = output<void>();

  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly market = inject(MarketDataService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly router = inject(Router);

  protected readonly user = computed(() => this.auth.currentUser());
  protected readonly unread = computed(() => this.notifications.unreadCount());

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login']);
  }
}
