import { Routes } from '@angular/router';

export const CALCULATOR_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'sip',
    pathMatch: 'full',
  },
  {
    path: 'sip',
    loadComponent: () =>
      import('./sip-calculator/sip-calculator.component').then(
        m => m.SipCalculatorComponent
      ),
  },
  {
    path: 'emi',
    loadComponent: () =>
      import('./emi-calculator/emi-calculator.component').then(
        m => m.EmiCalculatorComponent
      ),
  },
  {
    path: 'lumpsum',
    loadComponent: () =>
      import('./lumpsum-calculator/lumpsum-calculator.component').then(
        m => m.LumpsumCalculatorComponent
      ),
  },
  {
    path: 'fd',
    loadComponent: () =>
      import('./fd-calculator/fd-calculator.component').then(
        m => m.FdCalculatorComponent
      ),
  },
  {
    path: 'retirement',
    loadComponent: () =>
      import('./retirement-calculator/retirement-calculator.component').then(
        m => m.RetirementCalculatorComponent
      ),
  },
  {
    path: 'tax',
    loadComponent: () =>
      import('./tax-calculator/tax-calculator.component').then(
        m => m.TaxCalculatorComponent
      ),
  },
];
