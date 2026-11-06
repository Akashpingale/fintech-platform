import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Tab strip shared by every calculator page. */
@Component({
  selector: 'app-calculator-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav class="calc-nav" aria-label="Calculators">
      @for (item of items; track item.route) {
        <a
          class="calc-nav__item"
          [routerLink]="item.route"
          routerLinkActive="active"
        >
          <mat-icon>{{ item.icon }}</mat-icon>
          {{ item.label }}
        </a>
      }
    </nav>
  `,
  styles: [
    `
      .calc-nav {
        display: flex;
        gap: var(--sp-2);
        overflow-x: auto;
        padding-bottom: var(--sp-2);
        margin-bottom: var(--sp-5);
        scrollbar-width: none;
      }
      .calc-nav::-webkit-scrollbar {
        display: none;
      }
      .calc-nav__item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid var(--border);
        border-radius: var(--r-pill);
        background: var(--surface);
        color: var(--text-muted);
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 500;
        white-space: nowrap;
        flex: 0 0 auto;
        transition: background var(--t-fast), color var(--t-fast),
          border-color var(--t-fast);
      }
      .calc-nav__item:hover {
        background: var(--surface-2);
        color: var(--text);
      }
      .calc-nav__item.active {
        background: var(--primary-soft);
        border-color: transparent;
        color: var(--primary);
        font-weight: 600;
      }
      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
      }
    `,
  ],
})
export class CalculatorNavComponent {
  protected readonly items = [
    { label: 'SIP', icon: 'autorenew', route: '/calculators/sip' },
    { label: 'Lumpsum', icon: 'savings', route: '/calculators/lumpsum' },
    { label: 'EMI', icon: 'request_quote', route: '/calculators/emi' },
    { label: 'FD / RD', icon: 'account_balance', route: '/calculators/fd' },
    { label: 'Retirement', icon: 'beach_access', route: '/calculators/retirement' },
    { label: 'Tax', icon: 'receipt_long', route: '/calculators/tax' },
  ];
}
