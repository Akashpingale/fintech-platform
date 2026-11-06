import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Gradient hero panel shared by the login and register screens. */
@Component({
  selector: 'app-auth-hero',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <aside class="auth__hero">
      <div class="hero-brand">
        <mat-icon>account_balance</mat-icon>
        <span>FinTrack</span>
      </div>

      <h2 class="hero-headline">
        Every rupee, every holding — one clear picture.
      </h2>
      <p class="hero-copy">
        Track income and expenses, hold yourself to a budget, fund your goals
        and watch your portfolio, all in a single dashboard built for Indian
        investors.
      </p>

      <ul class="hero-points">
        @for (point of points; track point.label) {
          <li>
            <span class="hero-points__icon"><mat-icon>{{ point.icon }}</mat-icon></span>
            <span>
              <strong>{{ point.label }}</strong>
              <em>{{ point.detail }}</em>
            </span>
          </li>
        }
      </ul>

      <p class="hero-footnote">
        Demo build with seeded data · amounts in ₹ (INR)
      </p>
    </aside>
  `,
  styleUrl: './auth.shared.scss',
})
export class AuthHeroComponent {
  protected readonly points = [
    {
      icon: 'insights',
      label: 'Net worth at a glance',
      detail: 'Cash, goals and investments combined',
    },
    {
      icon: 'pie_chart',
      label: 'Portfolio across six asset types',
      detail: 'Stocks, funds, crypto, FDs, gold and bonds',
    },
    {
      icon: 'calculate',
      label: 'Seven financial calculators',
      detail: 'SIP, EMI, FD/RD, retirement and tax',
    },
    {
      icon: 'health_and_safety',
      label: 'Financial health score',
      detail: 'Savings, budgets, diversification, safety net',
    },
  ];
}
