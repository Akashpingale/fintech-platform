import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** 404 page with routes back into the app. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="page not-found">
      <div class="not-found__code">404</div>
      <h1 class="not-found__title">This page does not exist</h1>
      <p class="not-found__message">
        The link may be out of date, or the record it pointed at was deleted.
      </p>

      <div class="not-found__actions">
        <a class="btn btn--primary" routerLink="/dashboard">
          <mat-icon>dashboard</mat-icon>
          Go to dashboard
        </a>
        <a class="btn btn--ghost" routerLink="/transactions">
          <mat-icon>swap_horiz</mat-icon>
          Transactions
        </a>
        <a class="btn btn--ghost" routerLink="/calculators">
          <mat-icon>calculate</mat-icon>
          Calculators
        </a>
      </div>
    </div>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-height: 70vh;
        gap: var(--sp-2);
      }
      .not-found__code {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 5.5rem;
        font-weight: 800;
        line-height: 1;
        background: var(--grad-primary);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .not-found__title {
        font-size: var(--fs-h1);
        font-weight: 700;
      }
      .not-found__message {
        color: var(--text-muted);
        max-width: 46ch;
        margin: 0 0 var(--sp-5);
      }
      .not-found__actions {
        display: flex;
        gap: var(--sp-3);
        flex-wrap: wrap;
        justify-content: center;

        a {
          text-decoration: none;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    `,
  ],
})
export class NotFoundComponent {}
