import { Routes } from '@angular/router';

export const PORTFOLIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./portfolio-overview/portfolio-overview.component').then(
        m => m.PortfolioOverviewComponent
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./holding-detail/holding-detail.component').then(
        m => m.HoldingDetailComponent
      ),
  },
];
