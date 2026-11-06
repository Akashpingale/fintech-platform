import { Component, computed, inject } from '@angular/core';
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
import { positiveNumber } from '../../../shared/validators/app.validators';
import { CalculatorNavComponent } from '../calculator-nav.component';

/**
 * Lumpsum / compound interest calculator.
 * `A = P(1 + r/n)^(nt)` with a selectable compounding frequency.
 */
@Component({
  selector: 'app-lumpsum-calculator',
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
  templateUrl: './lumpsum-calculator.component.html',
  styleUrl: '../calculator.shared.scss',
})
export class LumpsumCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly frequencies = [
    { value: 1, label: 'Annually' },
    { value: 2, label: 'Half-yearly' },
    { value: 4, label: 'Quarterly' },
    { value: 12, label: 'Monthly' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    principal: [500000, [Validators.required, positiveNumber()]],
    annualReturn: [12, [Validators.required, Validators.min(1), Validators.max(30)]],
    years: [10, [Validators.required, Validators.min(1), Validators.max(40)]],
    compounding: [1, Validators.required],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Compound interest with the chosen frequency. */
  private compound(principal: number, rate: number, years: number, n: number): number {
    if (principal <= 0 || years <= 0) return principal;
    return principal * Math.pow(1 + rate / 100 / n, n * years);
  }

  protected readonly result = computed(() => {
    const v = this.values();
    const principal = Number(v?.principal ?? 0);
    const rate = Number(v?.annualReturn ?? 0);
    const years = Number(v?.years ?? 0);
    const n = Number(v?.compounding ?? 1);

    const futureValue = this.compound(principal, rate, years, n);
    const totalInterest = futureValue - principal;
    // Effective annual rate once compounding is taken into account.
    const effectiveRate = (Math.pow(1 + rate / 100 / n, n) - 1) * 100;

    return { principal, futureValue, totalInterest, effectiveRate, multiple: principal > 0 ? futureValue / principal : 0 };
  });

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const v = this.values();
    const principal = Number(v?.principal ?? 0);
    const rate = Number(v?.annualReturn ?? 0);
    const years = Number(v?.years ?? 0);
    const n = Number(v?.compounding ?? 1);

    const labels: string[] = [];
    const values: number[] = [];
    const invested: number[] = [];

    for (let year = 0; year <= years; year++) {
      labels.push(year === 0 ? 'Start' : `Yr ${year}`);
      values.push(Math.round(this.compound(principal, rate, year, n)));
      invested.push(Math.round(principal));
    }

    return {
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
          borderColor: '#16A34A',
          borderWidth: 2.5,
          fill: true,
          backgroundColor: context => this.charts.gradientFill(context, '#16A34A', 0.26),
          pointBackgroundColor: '#16A34A',
        },
        {
          label: 'Amount invested',
          data: invested,
          borderColor: this.charts.tokens().textMuted,
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'line'>(
        context =>
          `${context.dataset.label}: ${this.currency.format(
            Number(context.parsed.y)
          )}`
      ),
    },
    scales: this.charts.scales({
      yCallback: value => this.currency.formatCompact(value),
      beginAtZero: false,
    }),
  }));
}
