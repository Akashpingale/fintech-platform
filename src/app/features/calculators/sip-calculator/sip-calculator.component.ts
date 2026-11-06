import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartData, ChartOptions } from 'chart.js';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { calculateSip } from '../../../shared/utils/calculator.utils';
import { positiveNumber } from '../../../shared/validators/app.validators';
import { CalculatorNavComponent } from '../calculator-nav.component';

/** SIP calculator — monthly investment projected to a maturity value. */
@Component({
  selector: 'app-sip-calculator',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatIconModule,
    ChartCardComponent,
    PageHeaderComponent,
    CalculatorNavComponent,
    MoneyPipe,
  ],
  templateUrl: './sip-calculator.component.html',
  styleUrl: '../calculator.shared.scss',
})
export class SipCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly form = this.fb.nonNullable.group({
    monthlyInvestment: [10000, [Validators.required, positiveNumber()]],
    annualReturn: [12, [Validators.required, Validators.min(1), Validators.max(30)]],
    years: [10, [Validators.required, Validators.min(1), Validators.max(40)]],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly result = computed(() => {
    const v = this.values();
    return calculateSip(
      Number(v?.monthlyInvestment ?? 0),
      Number(v?.annualReturn ?? 0),
      Number(v?.years ?? 0)
    );
  });

  /** Share of the maturity value that is return rather than contribution. */
  protected readonly gainShare = computed(() => {
    const r = this.result();
    return r.futureValue > 0 ? (r.totalInterest / r.futureValue) * 100 : 0;
  });

  /** Year-by-year growth, for the stacked chart. */
  protected readonly growth = computed(() => {
    const v = this.values();
    const monthly = Number(v?.monthlyInvestment ?? 0);
    const rate = Number(v?.annualReturn ?? 0);
    const years = Number(v?.years ?? 0);

    const labels: string[] = [];
    const invested: number[] = [];
    const gain: number[] = [];

    for (let year = 1; year <= years; year++) {
      const step = calculateSip(monthly, rate, year);
      labels.push(`Yr ${year}`);
      invested.push(Math.round(step.investedAmount));
      gain.push(Math.round(step.totalInterest));
    }
    return { labels, invested, gain };
  });

  protected readonly chartData = computed<ChartData<'bar'>>(() => {
    const g = this.growth();
    return {
      labels: g.labels,
      datasets: [
        {
          label: 'Invested',
          data: g.invested,
          backgroundColor: this.charts.withAlpha('#4F46E5', 0.5),
          borderRadius: 6,
          stack: 'total',
        },
        {
          label: 'Returns',
          data: g.gain,
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

  protected readonly splitData = computed<ChartData<'doughnut'>>(() => {
    const r = this.result();
    return {
      labels: ['Invested', 'Returns'],
      datasets: [
        {
          data: [Math.round(r.investedAmount), Math.round(r.totalInterest)],
          backgroundColor: ['#4F46E5', '#16A34A'],
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    };
  });

  protected readonly splitOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      legend: this.charts.legend(),
      tooltip: this.charts.tooltip<'doughnut'>(
        context => `${context.label}: ${this.currency.format(Number(context.parsed))}`
      ),
    },
  }));
}
