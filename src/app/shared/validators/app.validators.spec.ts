import { FormControl, FormGroup } from '@angular/forms';
import {
  dateRange,
  fieldsMatch,
  firstErrorMessage,
  futureDate,
  nonNegativeNumber,
  notInFuture,
  passwordStrength,
  positiveNumber,
} from './app.validators';

describe('passwordStrength', () => {
  const validate = passwordStrength();

  it('accepts a password meeting every rule', () => {
    expect(validate(new FormControl('Str0ng!Pass'))).toBeNull();
  });

  it('ignores an empty value so `required` owns that message', () => {
    expect(validate(new FormControl(''))).toBeNull();
  });

  it('reports exactly which rules failed', () => {
    const errors = validate(new FormControl('abc'));
    expect(errors?.['passwordStrength']).toEqual({
      minLength: true,
      lowercase: false,
      uppercase: true,
      digit: true,
      symbol: true,
    });
  });

  it('rejects a long password with no symbol', () => {
    expect(validate(new FormControl('Abcdefgh1'))).not.toBeNull();
  });
});

describe('positiveNumber and nonNegativeNumber', () => {
  it('rejects zero and negatives as not positive', () => {
    const validate = positiveNumber();
    expect(validate(new FormControl(1))).toBeNull();
    expect(validate(new FormControl(0))).not.toBeNull();
    expect(validate(new FormControl(-5))).not.toBeNull();
  });

  it('accepts zero but rejects negatives when non-negative', () => {
    const validate = nonNegativeNumber();
    expect(validate(new FormControl(0))).toBeNull();
    expect(validate(new FormControl(-0.01))).not.toBeNull();
  });

  it('rejects values that are not numbers', () => {
    expect(positiveNumber()(new FormControl('abc'))).not.toBeNull();
  });

  it('ignores empty values', () => {
    expect(positiveNumber()(new FormControl(''))).toBeNull();
    expect(positiveNumber()(new FormControl(null))).toBeNull();
  });
});

describe('date validators', () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it('notInFuture accepts today and the past, rejects the future', () => {
    const validate = notInFuture();
    expect(validate(new FormControl(yesterday))).toBeNull();
    expect(validate(new FormControl(new Date().toISOString().slice(0, 10)))).toBeNull();
    expect(validate(new FormControl(tomorrow))).not.toBeNull();
  });

  it('futureDate accepts today and later, rejects the past', () => {
    const validate = futureDate();
    expect(validate(new FormControl(tomorrow))).toBeNull();
    expect(validate(new FormControl(yesterday))).not.toBeNull();
  });

  it('dateRange rejects a start later than the end', () => {
    const validate = dateRange('from', 'to');
    const ok = new FormGroup({
      from: new FormControl('2026-01-01'),
      to: new FormControl('2026-02-01'),
    });
    const bad = new FormGroup({
      from: new FormControl('2026-03-01'),
      to: new FormControl('2026-02-01'),
    });
    expect(validate(ok)).toBeNull();
    expect(validate(bad)).toEqual({ dateRange: true });
  });

  it('dateRange ignores a partially filled range', () => {
    const validate = dateRange('from', 'to');
    const partial = new FormGroup({
      from: new FormControl('2026-03-01'),
      to: new FormControl(null),
    });
    expect(validate(partial)).toBeNull();
  });
});

describe('fieldsMatch', () => {
  const validate = fieldsMatch('a', 'b');

  it('passes when both values are identical', () => {
    const group = new FormGroup({
      a: new FormControl('secret'),
      b: new FormControl('secret'),
    });
    expect(validate(group)).toBeNull();
  });

  it('fails when the values differ', () => {
    const group = new FormGroup({
      a: new FormControl('secret'),
      b: new FormControl('other'),
    });
    expect(validate(group)).toEqual({ fieldsMatch: true });
  });

  it('stays quiet until both fields have a value', () => {
    const group = new FormGroup({
      a: new FormControl('secret'),
      b: new FormControl(''),
    });
    expect(validate(group)).toBeNull();
  });
});

describe('firstErrorMessage', () => {
  it('returns an empty string for a valid control', () => {
    expect(firstErrorMessage(new FormControl('x'))).toBe('');
  });

  it('prefers the required message and names the field', () => {
    const control = new FormControl('');
    control.setErrors({ required: true });
    expect(firstErrorMessage(control, 'Amount')).toBe('Amount is required.');
  });

  it('describes a positive-number failure', () => {
    const control = new FormControl(0);
    control.setErrors({ positiveNumber: { reason: 'not-positive' } });
    expect(firstErrorMessage(control, 'Quantity')).toBe(
      'Quantity must be greater than zero.'
    );
  });

  it('falls back to a generic message for an unknown error', () => {
    const control = new FormControl('x');
    control.setErrors({ somethingElse: true });
    expect(firstErrorMessage(control, 'Field')).toBe('Field is invalid.');
  });
});
