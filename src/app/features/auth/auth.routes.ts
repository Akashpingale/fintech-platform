import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign in · FinTrack',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Create account · FinTrack',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./register/register.component').then(m => m.RegisterComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
