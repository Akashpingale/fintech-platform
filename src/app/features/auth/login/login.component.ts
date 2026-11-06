import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AuthService,
  DEMO_CREDENTIALS,
} from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppDataService } from '../../../core/services/app-data.service';
import { firstErrorMessage } from '../../../shared/validators/app.validators';
import { AuthHeroComponent } from '../auth-hero.component';

/** Sign-in screen. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    AuthHeroComponent,
  ],
  template: `
    <div class="auth">
      <app-auth-hero />

      <div class="auth__form-side">
        <div class="card auth__card">
          <h1 class="auth-title">Welcome back</h1>
          <p class="muted auth-sub">
            Sign in to see your net worth, budgets and portfolio.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Email address</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                autocomplete="email"
                placeholder="you@example.com"
              />
              <mat-icon matPrefix>mail_outline</mat-icon>
              <mat-error>{{ errorFor('email', 'Email') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password"
              />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button
                type="button"
                matIconSuffix
                class="icon-btn"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="
                  showPassword() ? 'Hide password' : 'Show password'
                "
              >
                <mat-icon>{{
                  showPassword() ? 'visibility_off' : 'visibility'
                }}</mat-icon>
              </button>
              <mat-error>{{ errorFor('password', 'Password') }}</mat-error>
            </mat-form-field>

            @if (failure()) {
              <p class="auth-error" role="alert">
                <mat-icon>error_outline</mat-icon>
                {{ failure() }}
              </p>
            }

            <button
              type="submit"
              class="btn btn--primary auth-submit"
              [disabled]="busy()"
            >
              @if (busy()) {
                <mat-spinner diameter="18" />
                Signing in…
              } @else {
                Sign in
                <mat-icon>arrow_forward</mat-icon>
              }
            </button>
          </form>

          <div class="demo-box">
            <div class="demo-box__head">
              <mat-icon>bolt</mat-icon>
              <strong>Demo account</strong>
            </div>
            <p class="muted">
              {{ demo.email }} / {{ demo.password }}
            </p>
            <button type="button" class="btn btn--ghost" (click)="useDemo()">
              Fill demo credentials
            </button>
          </div>

          <p class="auth-switch">
            New here?
            <a routerLink="/auth/register">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrl: '../auth.shared.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationService);
  private readonly appData = inject(AppDataService);

  protected readonly demo = DEMO_CREDENTIALS;
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal('');

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected useDemo(): void {
    this.form.setValue({
      email: this.demo.email,
      password: this.demo.password,
    });
    this.failure.set('');
  }

  protected submit(): void {
    this.failure.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.busy.set(true);

    this.auth.login(email, password).subscribe({
      next: user => {
        this.busy.set(false);
        this.appData.bootstrap();
        this.toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
        const redirect = new URLSearchParams(
          window.location.search
        ).get('redirect');
        void this.router.navigateByUrl(redirect ?? '/dashboard');
      },
      error: (error: Error) => {
        this.busy.set(false);
        this.failure.set(error.message || 'Could not sign you in.');
      },
    });
  }
}
