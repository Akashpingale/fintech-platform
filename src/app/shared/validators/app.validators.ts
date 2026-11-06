import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

/**
 * Requires a lowercase letter, an uppercase letter, a digit, a symbol and
 * at least 8 characters. Reports which rules failed so the UI can show a
 * checklist instead of a single opaque message.
 */
export function passwordStrength(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null;

    const unmet = {
      minLength: value.length < 8,
      lowercase: !/[a-z]/.test(value),
      uppercase: !/[A-Z]/.test(value),
      digit: !/\d/.test(value),
      symbol: !/[^A-Za-z0-9]/.test(value),
    };

    return Object.values(unmet).some(Boolean)
      ? { passwordStrength: unmet }
      : null;
  };
}

/** Rejects zero and negative numbers (amounts, quantities, prices). */
export function positiveNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === '') return null;
    const n = Number(control.value);
    if (Number.isNaN(n)) return { positiveNumber: { reason: 'not-a-number' } };
    return n > 0 ? null : { positiveNumber: { reason: 'not-positive' } };
  };
}

/** Allows zero but rejects negatives (fees, existing savings). */
export function nonNegativeNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === '') return null;
    const n = Number(control.value);
    if (Number.isNaN(n)) return { nonNegativeNumber: { reason: 'not-a-number' } };
    return n >= 0 ? null : { nonNegativeNumber: { reason: 'negative' } };
  };
}

/** Group validator: `from` must not be later than `to`. */
export function dateRange(fromKey: string, toKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const from = group.get(fromKey)?.value as string | Date | null;
    const to = group.get(toKey)?.value as string | Date | null;
    if (!from || !to) return null;
    return new Date(from).getTime() <= new Date(to).getTime()
      ? null
      : { dateRange: true };
  };
}

/** Rejects dates in the future (a transaction cannot be recorded ahead of time). */
export function notInFuture(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return new Date(control.value as string).getTime() <= endOfToday.getTime()
      ? null
      : { notInFuture: true };
  };
}

/** Rejects dates in the past (goal and SIP deadlines). */
export function futureDate(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return new Date(control.value as string).getTime() >= startOfToday.getTime()
      ? null
      : { futureDate: true };
  };
}

/** Group validator: two controls must hold the same value. */
export function fieldsMatch(aKey: string, bKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(aKey)?.value;
    const b = group.get(bKey)?.value;
    if (a === null || a === '' || b === null || b === '') return null;
    return a === b ? null : { fieldsMatch: true };
  };
}

/** First failing message for a control, for inline `<mat-error>` text. */
export function firstErrorMessage(
  control: AbstractControl | null,
  label = 'This field'
): string {
  if (!control?.errors) return '';
  const e = control.errors;
  if (e['required']) return `${label} is required.`;
  if (e['email']) return 'Enter a valid email address.';
  if (e['positiveNumber']) return `${label} must be greater than zero.`;
  if (e['nonNegativeNumber']) return `${label} cannot be negative.`;
  if (e['notInFuture']) return 'The date cannot be in the future.';
  if (e['futureDate']) return 'Pick a date in the future.';
  if (e['min']) return `${label} is below the allowed minimum.`;
  if (e['max']) return `${label} is above the allowed maximum.`;
  if (e['maxlength']) return `${label} is too long.`;
  if (e['passwordStrength']) return 'Password does not meet all the rules below.';
  return `${label} is invalid.`;
}
