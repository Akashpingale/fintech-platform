import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import {
  CURRENCIES,
  CurrencyCode,
  CurrencyService,
} from '../../core/services/currency.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { BackupService } from '../../core/services/backup.service';
import { AppDataService } from '../../core/services/app-data.service';
import { StorageService } from '../../core/services/storage.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { confirmAction } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  fieldsMatch,
  firstErrorMessage,
  passwordStrength,
  positiveNumber,
} from '../../shared/validators/app.validators';

/**
 * Settings — Section 3.12 and the profile part of 3.1.
 * Profile, currency, theme, password change, backup/restore and sign-out.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly backup = inject(BackupService);
  private readonly appData = inject(AppDataService);
  private readonly storage = inject(StorageService);

  protected readonly auth = inject(AuthService);
  protected readonly currency = inject(CurrencyService);
  protected readonly theme = inject(ThemeService);
  protected readonly market = inject(MarketDataService);

  protected readonly currencies = CURRENCIES;
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly restoring = signal(false);

  protected readonly user = computed(() => this.auth.currentUser());

  protected readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    monthlyIncome: [0, [Validators.required, positiveNumber()]],
    riskProfile: ['moderate' as 'low' | 'moderate' | 'high', Validators.required],
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordStrength()]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [fieldsMatch('newPassword', 'confirmPassword')] }
  );

  constructor() {
    const user = this.auth.currentUser();
    if (user) {
      this.profileForm.patchValue({
        name: user.name,
        email: user.email,
        monthlyIncome: user.monthlyIncome,
        riskProfile: user.riskProfile,
      });
    }
  }

  /**
   * Error text for a control. Split per form because the two groups have
   * different control maps, so a shared `group.get()` call would not type.
   */
  protected profileError(control: string, label: string): string {
    return firstErrorMessage(this.profileForm.get(control), label);
  }

  protected passwordError(control: string, label: string): string {
    return firstErrorMessage(this.passwordForm.get(control), label);
  }

  // ─────────────────────────────── Profile ───────────────────────────────

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    const value = this.profileForm.getRawValue();

    this.auth
      .updateProfile({
        name: value.name.trim(),
        email: value.email.trim().toLowerCase(),
        monthlyIncome: Number(value.monthlyIncome),
        riskProfile: value.riskProfile,
      })
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.toast.success('Profile saved.');
        },
        error: (error: Error) => {
          this.savingProfile.set(false);
          this.toast.error(error.message || 'Could not save your profile.');
        },
      });
  }

  // ─────────────────────────── Currency & theme ───────────────────────────

  protected setCurrency(code: CurrencyCode): void {
    this.currency.setCode(code);
    // Keep the stored profile in step with the display currency.
    this.auth.updateProfile({ currency: code }).subscribe({
      error: () => {
        /* Display currency already applied; a profile write failure is not fatal. */
      },
    });
    this.toast.success(`Amounts now shown in ${code}.`);
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  // ─────────────────────────────── Password ───────────────────────────────

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        this.toast.success('Password changed.');
      },
      error: (error: Error) => {
        this.savingPassword.set(false);
        this.toast.error(error.message || 'Could not change the password.');
      },
    });
  }

  // ──────────────────────────── Backup & restore ────────────────────────────

  protected downloadBackup(): void {
    this.backup.download();
    this.toast.success('Backup downloaded.');
  }

  protected onRestoreFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    confirmAction(this.dialog, {
      title: 'Replace your current data?',
      message:
        'Restoring overwrites the transactions, budgets, goals, holdings, SIPs and watchlist currently loaded in the app.',
      confirmLabel: 'Restore backup',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) {
        input.value = '';
        return;
      }

      this.restoring.set(true);
      this.backup.restore(file).subscribe({
        next: summary => {
          this.restoring.set(false);
          input.value = '';
          const total = Object.values(summary).reduce((a, b) => a + b, 0);
          this.toast.success(
            `Restored ${total} records across ${Object.keys(summary).length} collections.`
          );
        },
        error: (error: Error) => {
          this.restoring.set(false);
          input.value = '';
          this.toast.error(error.message || 'Could not restore that file.');
        },
      });
    });
  }

  protected reloadFromApi(): void {
    this.appData.reload();
    this.toast.success('Reloaded from the mock API.');
  }

  protected clearLocalCache(): void {
    confirmAction(this.dialog, {
      title: 'Clear the local cache?',
      message:
        'FinTrack mirrors every collection into localStorage so the app works offline. Clearing it keeps your account but drops the offline copy; data reloads from the mock API.',
      confirmLabel: 'Clear cache',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      for (const key of [
        'transactions',
        'budgets',
        'goals',
        'holdings',
        'assetTransactions',
        'sips',
        'watchlist',
        'notifications',
        'marketPrices',
      ]) {
        this.storage.remove(key);
      }
      this.appData.reload();
      this.toast.success('Local cache cleared and data reloaded.');
    });
  }

  // ─────────────────────────────── Session ───────────────────────────────

  protected signOut(): void {
    confirmAction(this.dialog, {
      title: 'Sign out of FinTrack?',
      message: 'Your data stays saved; you will need to sign in again.',
      confirmLabel: 'Sign out',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.auth.logout();
      void this.router.navigate(['/auth/login']);
    });
  }
}
