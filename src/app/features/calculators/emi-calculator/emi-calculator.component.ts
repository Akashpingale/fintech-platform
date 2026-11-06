import { Component, computed, inject, signal } from '@angular/core';
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
import { ExportService } from '../../../core/services/export.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { calculateEmi } from '../../../shared/utils/calculator.utils';
import { positiveNumber } from '../../../shared/validators/app.validators';
import { CalculatorNavComponent } from '../calculator-nav.component';

/** One year of the amortisation schedule, aggregated. */
interface YearRow {
  year: number;
  principal: number;
  interest: number;
  total: number;
  balance: number;
}

/**
 * EMI calculator — Section 3.8.
 * Monthly instalment, total interest and a full amortisation schedule that can
 * be viewed by year or by month and exported as CSV.
 */
@Component({
  selector: 'app-emi-calculator',
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
  templateUrl: './emi-calculator.component.html',
  styleUrl: '../calculator.shared.scss',
})
export class EmiCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);
  private readonly exports = inject(ExportService);
  private readonly toast = inject(NotificationService);

  /** Preset loan types, which just seed the sliders. */
  protected readonly presets = [
    { label: 'Home loan', amount: 5000000, rate: 8.5, years: 20, icon: 'home' },
    { label: 'Car loan', amount: 900000, rate: 9.5, years: 7, icon: 'directions_car' },
    { label: 'Personal loan', amount: 500000, rate: 13.5, years: 5, icon: 'person' },
    { label: 'Education loan', amount: 1500000, rate: 10.5, years: 10, icon: 'school' },
  ];

  protected readonly scheduleView = signal<'year' | 'month'>('year');

  protected readonly form = this.fb.nonNullable.group({
    loanAmount: [5000000, [Validators.required, positiveNumber()]],
    annualRate: [8.5, [Validators.required, Validators.min(0.5), Validators.max(30)]],
    years: [20, [Validators.required, Validators.min(1), Validators.max(30)]],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly result = computed(() => {
    const v = this.values();
    return calculateEmi(
      Number(v?.loanAmount ?? 0),
      Number(v?.annualRate ?? 0),
      Number(v?.years ?? 0)
    );
  });

  /** Interest as a share of everything repaid. */
  protected readonly interestShare = computed(() => {
    const r = this.result();
    return r.totalPayment > 0 ? (r.totalInterest / r.totalPayment) * 100 : 0;
  });

  /** The schedule grouped into years. */
  protected readonly yearly = computed<YearRow[]>(() => {
    const rows: YearRow[] = [];
    const schedule = this.result().schedule;

    for (let index = 0; index < schedule.length; index += 12) {
      const chunk = schedule.slice(index, index + 12);
      const principal = chunk.reduce((sum, m) => sum + m.principal, 0);
      const interest = chunk.reduce((sum, m) => sum + m.interest, 0);
      rows.push({
        year: Math.floor(index / 12) + 1,
        principal,
        interest,
        total: principal + interest,
        balance: chunk[chunk.length - 1].balance,
      });
    }
    return rows;
  });

  protected readonly monthly = computed(() => this.result().schedule);

  // ─────────────────────────────── Charts ───────────────────────────────

  protected readonly splitData = computed<ChartData<'doughnut'>>(() => {
    const r = this.result();
    const v = this.values();
    return {
      labels: ['Principal', 'Interest'],
      datasets: [
        {
          data: [Math.round(Number(v?.loanAmount ?? 0)), Math.round(r.totalInterest)],
          backgroundColor: ['#4F46E5', '#DC2626'],
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

  protected readonly balanceData = computed<ChartData<'bar'>>(() => {
    const rows = this.yearly();
    return {
      labels: rows.map(r => `Yr ${r.year}`),
      datasets: [
        {
          label: 'Principal repaid',
          data: rows.map(r => Math.round(r.principal)),
          backgroundColor: this.charts.withAlpha('#4F46E5', 0.75),
          borderRadius: 5,
          stack: 'payment',
        },
        {
          label: 'Interest paid',
          data: rows.map(r => Math.round(r.interest)),
          backgroundColor: this.charts.withAlpha('#DC2626', 0.75),
          borderRadius: 5,
          stack: 'payment',
        },
      ],
    };
  });

  protected readonly balanceOptions = computed<ChartOptions<'bar'>>(() => ({
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

  protected applyPreset(preset: (typeof this.presets)[number]): void {
    this.form.setValue({
      loanAmount: preset.amount,
      annualRate: preset.rate,
      years: preset.years,
    });
  }

  protected setView(view: 'year' | 'month'): void {
    this.scheduleView.set(view);
  }

  protected exportSchedule(): void {
    const rows = this.monthly();
    if (rows.length === 0) {
      this.toast.info('Nothing to export yet.');
      return;
    }
    this.exports.downloadCsv(
      'fintrack-amortisation',
      rows.map(row => ({
        Month: row.month,
        Year: Math.ceil(row.month / 12),
        EMI: Math.round(this.result().emi),
        'Principal component': Math.round(row.principal),
        'Interest component': Math.round(row.interest),
        'Closing balance': Math.round(row.balance),
      }))
    );
    this.toast.success(`Exported ${rows.length} rows of the schedule.`);
  }
}
