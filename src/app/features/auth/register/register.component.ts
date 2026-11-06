import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppDataService } from '../../../core/services/app-data.service';
import {
  fieldsMatch,
  firstErrorMessage,
  passwordStrength,
  positiveNumber,
} from '../../../shared/validators/app.validators';
import { AuthHeroComponent } from '../auth-hero.component';

/** Account creation screen with a live password-rule checklist. */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    AuthHeroComponent,
  ],
  template: `
    <div class="auth">
      <app-auth-hero />

      <div class="auth__form-side">
        <div class="card auth__card">
          <h1 class="auth-title">Create your account</h1>
          <p class="muted auth-sub">
            It takes a minute, and nothing leaves your browser.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Full name</mat-label>
              <input matInput formControlName="name" autocomplete="name" />
              <mat-icon matPrefix>person_outline</mat-icon>
              <mat-error>{{ errorFor('name', 'Name') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email address</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                autocomplete="email"
              />
              <mat-icon matPrefix>mail_outline</mat-icon>
              <mat-error>{{ errorFor('email', 'Email') }}</mat-error>
            </mat-form-field>

            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Monthly income (₹)</mat-label>
                <input
                  matInput
                  type="number"
                  min="1"
                  formControlName="monthlyIncome"
                />
                <mat-error>{{
                  errorFor('monthlyIncome', 'Monthly income')
                }}</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Risk profile</mat-label>
                <mat-select formControlName="riskProfile">
                  <mat-option value="low">Low — capital safety first</mat-option>
                  <mat-option value="moderate">Moderate — balanced</mat-option>
                  <mat-option value="high">High — growth focused</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="new-password"
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
            </mat-form-field>

            <ul class="rule-list" aria-label="Password requirements">
              @for (rule of ruleList(); track rule.key) {
                <li [class.met]="rule.met">
                  <mat-icon>{{
                    rule.met ? 'check_circle' : 'radio_button_unchecked'
                  }}</mat-icon>
                  {{ rule.label }}
                </li>
              }
            </ul>

            <mat-form-field appearance="outline" class="mt-4">
              <mat-label>Confirm password</mat-label>
              <input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
              <mat-icon matPrefix>lock</mat-icon>
              @if (form.hasError('fieldsMatch') && form.get('confirmPassword')?.touched) {
                <mat-error>The two passwords do not match.</mat-error>
              }
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
                Creating account…
              } @else {
                Create account
                <mat-icon>arrow_forward</mat-icon>
              }
            </button>
          </form>

          <p class="auth-switch">
            Already registered?
            <a routerLink="/auth/login">Sign in instead</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrl: '../auth.shared.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationService);
  private readonly appData = inject(AppDataService);

  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal('');

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      monthlyIncome: [50000, [Validators.required, positiveNumber()]],
      riskProfile: ['moderate' as 'low' | 'moderate' | 'high', Validators.required],
      password: ['', [Validators.required, passwordStrength()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('password', 'confirmPassword')] }
  );

  /** Live view of the password control's value, for the rule checklist. */
  private readonly passwordValue = toSignal(
    this.form.controls.password.valueChanges,
    { initialValue: '' }
  );

  protected readonly ruleList = computed(() => {
    const value = this.passwordValue() ?? '';
    return [
      { key: 'minLength', label: 'At least 8 characters', met: value.length >= 8 },
      { key: 'uppercase', label: 'An uppercase letter', met: /[A-Z]/.test(value) },
      { key: 'lowercase', label: 'A lowercase letter', met: /[a-z]/.test(value) },
      { key: 'digit', label: 'A number', met: /\d/.test(value) },
      { key: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(value) },
    ];
  });

  protected errorFor(control: string, label: string): string {
    return firstErrorMessage(this.form.get(control), label);
  }

  protected submit(): void {
    this.failure.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password, monthlyIncome, riskProfile } =
      this.form.getRawValue();
    this.busy.set(true);

    this.auth
      .register({ name, email, password, monthlyIncome, riskProfile })
      .subscribe({
        next: user => {
          this.busy.set(false);
          this.appData.bootstrap();
          this.toast.success(`Account created — welcome, ${user.name.split(' ')[0]}!`);
          void this.router.navigate(['/dashboard']);
        },
        error: (error: Error) => {
          this.busy.set(false);
          this.failure.set(error.message || 'Could not create the account.');
        },
      });
  }
}
