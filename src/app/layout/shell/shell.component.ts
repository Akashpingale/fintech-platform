import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { LoadingService } from '../../core/services/loading.service';
import { AppDataService } from '../../core/services/app-data.service';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';

const SIDEBAR_KEY = 'fintech-sidebar-collapsed';

/** Route segment → toolbar title. */
const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  budgets: 'Budgets',
  goals: 'Savings Goals',
  portfolio: 'Investment Portfolio',
  watchlist: 'Watchlist',
  sip: 'SIP Tracker',
  calculators: 'Financial Calculators',
  analytics: 'Analytics & Insights',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
};

/**
 * Main layout: sidebar, toolbar and the routed page.
 * Also the single place that kicks off the initial data load.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    ToolbarComponent,
    MatProgressBarModule,
  ],
  template: `
    @if (loading.isLoading()) {
      <mat-progress-bar mode="indeterminate" class="global-loader" />
    }

    <div class="shell" [class.collapsed]="sidebarCollapsed()">
      <app-sidebar
        [collapsed]="sidebarCollapsed()"
        (toggleCollapse)="toggleSidebar()"
      />
      <div class="main-area">
        <app-toolbar
          [sidebarCollapsed]="sidebarCollapsed()"
          [pageTitle]="pageTitle()"
          (toggleSidebar)="toggleSidebar()"
        />
        <main id="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly appData = inject(AppDataService);
  private readonly storage = inject(StorageService);

  readonly sidebarCollapsed = signal(this.restoreCollapsed());

  /** First path segment of the active route. */
  private readonly activeSegment = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard'),
      startWith(
        this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard'
      )
    ),
    { initialValue: 'dashboard' }
  );

  protected readonly pageTitle = computed(
    () => PAGE_TITLES[this.activeSegment()] ?? 'FinTrack'
  );

  constructor() {
    // Public calculators can be viewed signed out; everything else needs data.
    if (this.auth.isAuthenticated()) {
      this.appData.bootstrap();
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(collapsed => {
      const next = !collapsed;
      // Via StorageService so a missing localStorage cannot throw.
      this.storage.set(SIDEBAR_KEY, next);
      return next;
    });
  }

  private restoreCollapsed(): boolean {
    return this.storage.get<boolean>(SIDEBAR_KEY) === true;
  }
}
