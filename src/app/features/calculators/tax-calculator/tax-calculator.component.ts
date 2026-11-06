import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartData, ChartOptions } from 'chart.js';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  TaxRegime,
  compareRegimes,
} from '../../../shared/utils/calculator.utils';
import { nonNegativeNumber } from '../../../shared/validators/app.validators';
import { CalculatorNavComponent } from '../calculator-nav.component';

/**
 * Tax estimator — Section 3.8.
 * Compares the old and new Indian regimes side by side with a slab breakdown.
 */
@Component({
  selector: 'app-tax-calculator',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatIconModule,
    MatTooltipModule,
    ChartCardComponent,
    PageHeaderComponent,
    CalculatorNavComponent,
    MoneyPipe,
  ],
  templateUrl: './tax-calculator.component.html',
  styleUrls: ['../calculator.shared.scss', './tax-calculator.component.scss'],
})
export class TaxCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly form = this.fb.nonNullable.group({
    grossIncome: [1200000, [Validators.required, nonNegativeNumber()]],
    deductions: [150000, [Validators.required, nonNegativeNumber()]],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly comparison = computed(() =>
    compareRegimes(
      Number(this.values()?.grossIncome ?? 0),
      Number(this.values()?.deductions ?? 0)
    )
  );

  protected readonly better = computed(() => this.comparison().better);
  protected readonly oldResult = computed(() => this.comparison().old);
  protected readonly newResult = computed(() => this.comparison().new);

  // ─────────────────────────────── Chart ───────────────────────────────

  protected readonly chartData = computed<ChartData<'bar'>>(() => {
    const c = this.comparison();
    return {
      labels: ['Old regime', 'New regime'],
      datasets: [
        {
          label: 'Tax payable',
          data: [Math.round(c.old.totalTax), Math.round(c.new.totalTax)],
          backgroundColor: [
            c.better === 'old' ? '#16A34A' : this.charts.withAlpha('#DC2626', 0.75),
            c.better === 'new' ? '#16A34A' : this.charts.withAlpha('#DC2626', 0.75),
          ],
          borderRadius: 8,
          maxBarThickness: 76,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: this.charts.legend(false),
      tooltip: this.charts.tooltip<'bar'>(context =>
        this.currency.format(Number(context.parsed.y))
      ),
    },
    scales: this.charts.scales({
      yCallback: value => this.currency.formatCompact(value),
    }),
  }));

  // ───────────────────────────── Presentation ─────────────────────────────

  protected resultFor(regime: TaxRegime) {
    return regime === 'old' ? this.oldResult() : this.newResult();
  }

  /** `₹4,00,001 – ₹8,00,000` style band label. */
  protected slabLabel(from: number, to: number | null): string {
    const start = this.currency.formatCompact(from === 0 ? 0 : from + 1);
    return to === null
      ? `Above ${this.currency.formatCompact(from)}`
      : `${start} – ${this.currency.formatCompact(to)}`;
  }
}
