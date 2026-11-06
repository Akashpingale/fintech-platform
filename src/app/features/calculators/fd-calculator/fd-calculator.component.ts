import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartData, ChartOptions } from 'chart.js';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { calculateFd, calculateRd } from '../../../shared/utils/calculator.utils';
import { positiveNumber } from '../../../shared/validators/app.validators';
import { CalculatorNavComponent } from '../calculator-nav.component';

type Mode = 'fd' | 'rd';

/**
 * Fixed and recurring deposit calculator — Section 3.8.
 * FD compounds a single deposit; RD compounds a monthly instalment.
 */
@Component({
  selector: 'app-fd-calculator',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSelectModule,
    MatIconModule,
    ChartCardComponent,
    PageHeaderComponent,
    CalculatorNavComponent,
    MoneyPipe,
  ],
  templateUrl: './fd-calculator.component.html',
  styleUrl: '../calculator.shared.scss',
})
export class FdCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly mode = signal<Mode>('fd');

  protected readonly frequencies = [
    { value: 1, label: 'Annually' },
    { value: 2, label: 'Half-yearly' },
    { value: 4, label: 'Quarterly (typical for FDs)' },
    { value: 12, label: 'Monthly' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    amount: [200000, [Validators.required, positiveNumber()]],
    annualRate: [7.1, [Validators.required, Validators.min(0.5), Validators.max(15)]],
    years: [5, [Validators.required, Validators.min(1), Validators.max(20)]],
    compounding: [4, Validators.required],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly result = computed(() => {
    const v = this.values();
    const amount = Number(v?.amount ?? 0);
    const rate = Number(v?.annualRate ?? 0);
    const years = Number(v?.years ?? 0);
    const frequency = Number(v?.compounding ?? 4);

    if (this.mode() === 'rd') {
      // RD instalments compound monthly, which is how banks run them.
      const rd = calculateRd(amount, rate, years, 12);
      const invested = amount * years * 12;
      return {
        invested,
        maturity: rd.maturityAmount,
        interest: rd.interestEarned,
        instalments: years * 12,
      };
    }

    const fd = calculateFd(amount, rate, years, frequency);
    return {
      invested: amount,
      maturity: fd.maturityAmount,
      interest: fd.interestEarned,
      instalments: 1,
    };
  });

  /** Interest as a share of the maturity amount. */
  protected readonly interestShare = computed(() => {
    const r = this.result();
    return r.maturity > 0 ? (r.interest / r.maturity) * 100 : 0;
  });

  protected readonly amountLabel = computed(() =>
    this.mode() === 'rd' ? 'Monthly instalment' : 'Deposit amount'
  );

  // ─────────────────────────────── Chart ───────────────────────────────

  protected readonly chartData = computed<ChartData<'bar'>>(() => {
    const v = this.values();
    const amount = Number(v?.amount ?? 0);
    const rate = Number(v?.annualRate ?? 0);
    const years = Number(v?.years ?? 0);
    const frequency = Number(v?.compounding ?? 4);
    const isRd = this.mode() === 'rd';

    const labels: string[] = [];
    const invested: number[] = [];
    const interest: number[] = [];

    for (let year = 1; year <= years; year++) {
      const step = isRd
        ? calculateRd(amount, rate, year, 12)
        : calculateFd(amount, rate, year, frequency);
      const investedByThen = isRd ? amount * year * 12 : amount;
      const maturity = isRd
        ? (step as { maturityAmount: number }).maturityAmount
        : (step as { maturityAmount: number }).maturityAmount;

      labels.push(`Yr ${year}`);
      invested.push(Math.round(investedByThen));
      interest.push(Math.round(Math.max(0, maturity - investedByThen)));
    }

    return {
      labels,
      datasets: [
        {
          label: 'Deposited',
          data: invested,
          backgroundColor: this.charts.withAlpha('#0D9488', 0.55),
          borderRadius: 6,
          stack: 'total',
        },
        {
          label: 'Interest',
          data: interest,
          backgroundColor: '#16A34A',
          borderRadius: 6,
          stack: 'total',
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'bar'>(
        context =>
          `${context.dataset.label}: ${this.currency.format(
            Number(context.parsed.y)
          )}`
      ),
    },
    scales: this.charts.scales({
      stacked: true,
      yCallback: value => this.currency.formatCompact(value),
    }),
  }));

  // ─────────────────────────────── Actions ───────────────────────────────

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    // Sensible default amounts differ by an order of magnitude between the two.
    this.form.controls.amount.setValue(mode === 'rd' ? 10000 : 200000);
  }
}
