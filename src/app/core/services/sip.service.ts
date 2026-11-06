import { Injectable, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Sip } from '../models/sip.model';
import { CollectionStore } from './collection.store';
import { AuthService } from './auth.service';
import { calculateSip } from '../../shared/utils/calculator.utils';

/** A SIP with its schedule and projection worked out. */
export interface SipProgress {
  sip: Sip;
  /** Instalments already paid (capped at the plan duration). */
  instalmentsPaid: number;
  instalmentsLeft: number;
  invested: number;
  /** Value today, compounding only the instalments paid so far. */
  currentValue: number;
  /** Value at the end of the full plan. */
  maturityValue: number;
  totalInvestment: number;
  expectedGain: number;
  nextDueDate: Date;
  daysUntilDue: number;
  isComplete: boolean;
}

/** Systematic investment plans: schedule, projection and due reminders. */
@Injectable({ providedIn: 'root' })
export class SipService extends CollectionStore<Sip> {
  protected readonly endpoint = '/sips';
  protected readonly storageKey = 'sips';

  private readonly auth = inject(AuthService);

  /** All SIPs with progress, soonest due first. */
  readonly progress = computed<SipProgress[]>(() =>
    this.items()
      .map(sip => this.describe(sip))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  );

  readonly monthlyOutflow = computed(() =>
    this.progress()
      .filter(p => !p.isComplete)
      .reduce((sum, p) => sum + p.sip.amount, 0)
  );

  readonly totalInvested = computed(() =>
    this.progress().reduce((sum, p) => sum + p.invested, 0)
  );

  readonly totalCurrentValue = computed(() =>
    this.progress().reduce((sum, p) => sum + p.currentValue, 0)
  );

  /** SIPs due within the next seven days. */
  readonly dueSoon = computed(() =>
    this.progress().filter(p => !p.isComplete && p.daysUntilDue <= 7)
  );

  /** Works out schedule and projection for one SIP. */
  describe(sip: Sip): SipProgress {
    const start = new Date(sip.startDate);
    const now = new Date();

    const monthsElapsed =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()) +
      (now.getDate() >= sip.dayOfMonth ? 1 : 0);

    const instalmentsPaid = Math.max(
      0,
      Math.min(sip.durationMonths, monthsElapsed)
    );
    const instalmentsLeft = sip.durationMonths - instalmentsPaid;
    const isComplete = instalmentsLeft <= 0;

    const invested = instalmentsPaid * sip.amount;
    const current = calculateSip(
      sip.amount,
      sip.expectedReturn,
      instalmentsPaid / 12
    );
    const maturity = calculateSip(
      sip.amount,
      sip.expectedReturn,
      sip.durationMonths / 12
    );

    const nextDueDate = this.nextDue(sip, isComplete);
    const daysUntilDue = Math.ceil(
      (nextDueDate.getTime() - now.getTime()) / (24 * 3600 * 1000)
    );

    return {
      sip,
      instalmentsPaid,
      instalmentsLeft: Math.max(0, instalmentsLeft),
      invested,
      currentValue: instalmentsPaid > 0 ? current.futureValue : 0,
      maturityValue: maturity.futureValue,
      totalInvestment: sip.amount * sip.durationMonths,
      expectedGain: maturity.futureValue - sip.amount * sip.durationMonths,
      nextDueDate,
      daysUntilDue: isComplete ? Number.MAX_SAFE_INTEGER : daysUntilDue,
      isComplete,
    };
  }

  /**
   * Year-by-year projection of invested amount versus expected value, for the
   * SIP projection chart.
   */
  projection(sip: Sip): {
    labels: string[];
    invested: number[];
    value: number[];
  } {
    const years = Math.max(1, Math.ceil(sip.durationMonths / 12));
    const labels: string[] = [];
    const invested: number[] = [];
    const value: number[] = [];

    for (let year = 1; year <= years; year++) {
      const months = Math.min(sip.durationMonths, year * 12);
      const result = calculateSip(sip.amount, sip.expectedReturn, months / 12);
      labels.push(`Yr ${year}`);
      invested.push(Math.round(sip.amount * months));
      value.push(Math.round(result.futureValue));
    }
    return { labels, invested, value };
  }

  /** Creates a SIP for the current user. */
  add(draft: Omit<Sip, 'id' | 'userId'>): Observable<Sip> {
    return this.create({ ...draft, userId: this.auth.userId() });
  }

  /** The next instalment date, clamped to the end of the plan. */
  private nextDue(sip: Sip, isComplete: boolean): Date {
    if (isComplete) {
      const end = new Date(sip.startDate);
      end.setMonth(end.getMonth() + sip.durationMonths);
      return end;
    }
    const now = new Date();
    const candidate = new Date(now.getFullYear(), now.getMonth(), sip.dayOfMonth);
    if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
    return candidate;
  }
}
