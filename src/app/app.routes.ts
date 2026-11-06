import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes — Section 4 of the implementation plan.
 *
 * Every feature is lazy-loaded. The shell itself is not guarded so that the
 * calculators stay publicly reachable (the plan lists no guard for them);
 * every other child route carries `authGuard`.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Dashboard · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            m => m.DashboardComponent
          ),
      },
      {
        path: 'transactions',
        title: 'Transactions · FinTrack',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/transactions/transactions.routes').then(
            m => m.TRANSACTION_ROUTES
          ),
      },
      {
        path: 'budgets',
        title: 'Budgets · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/budgets/budgets.component').then(
            m => m.BudgetsComponent
          ),
      },
      {
        path: 'goals',
        title: 'Goals · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/goals/goals.component').then(m => m.GoalsComponent),
      },
      {
        path: 'portfolio',
        title: 'Portfolio · FinTrack',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/portfolio/portfolio.routes').then(
            m => m.PORTFOLIO_ROUTES
          ),
      },
      {
        path: 'watchlist',
        title: 'Watchlist · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/watchlist/watchlist.component').then(
            m => m.WatchlistComponent
          ),
      },
      {
        path: 'sip',
        title: 'SIP Tracker · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/sip/sip.component').then(m => m.SipComponent),
      },
      {
        // Public, per Section 4 — the calculators need no account.
        path: 'calculators',
        title: 'Calculators · FinTrack',
        loadChildren: () =>
          import('./features/calculators/calculators.routes').then(
            m => m.CALCULATOR_ROUTES
          ),
      },
      {
        path: 'analytics',
        title: 'Analytics · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(
            m => m.AnalyticsComponent
          ),
      },
      {
        path: 'reports',
        title: 'Reports · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            m => m.ReportsComponent
          ),
      },
      {
        path: 'notifications',
        title: 'Notifications · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            m => m.NotificationsComponent
          ),
      },
      {
        path: 'settings',
        title: 'Settings · FinTrack',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            m => m.SettingsComponent
          ),
      },
    ],
  },

  {
    path: '**',
    title: 'Page not found · FinTrack',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        m => m.NotFoundComponent
      ),
  },
];
