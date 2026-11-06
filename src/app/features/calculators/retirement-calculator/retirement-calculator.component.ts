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

/**
 * Retirement planner — Section 3.8.
 *
 * Works in three steps:
 *  1. inflate today's monthly expenses to the retirement date;
 *  2. size the corpus needed to fund that spend through retirement, using the
 *     inflation-adjusted (real) post-retirement return;
 *  3. project what the current savings plus monthly contributions will reach,
 *     and report the gap.
 */
@Component({
  selector: 'app-retirement-calculator',
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
  templateUrl: './retirement-calculator.component.html',
  styleUrl: '../calculator.shared.scss',
})
export class RetirementCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly charts = inject(ChartThemeService);
  private readonly currency = inject(CurrencyService);

  protected readonly form = this.fb.nonNullable.group({
    currentAge: [28, [Validators.required, Validators.min(18), Validators.max(70)]],
    retirementAge: [60, [Validators.required, Validators.min(40), Validators.max(80)]],
    lifeExpectancy: [85, [Validators.required, Validators.min(60), Validators.max(100)]],
    monthlyExpense: [50000, [Validators.required, positiveNumber()]],
    currentSavings: [500000, [Validators.required, Validators.min(0)]],
    monthlyContribution: [20000, [Validators.required, positiveNumber()]],
    preReturn: [12, [Validators.required, Validators.min(1), Validators.max(25)]],
    postReturn: [7, [Validators.required, Validators.min(1), Validators.max(15)]],
    inflation: [6, [Validators.required, Validators.min(0), Validators.max(15)]],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly plan = computed(() => {
    const v = this.values();
    const currentAge = Number(v?.currentAge ?? 0);
    const retirementAge = Number(v?.retirementAge ?? 0);
    const lifeExpectancy = Number(v?.lifeExpectancy ?? 0);
    const monthlyExpense = Number(v?.monthlyExpense ?? 0);
    const currentSavings = Number(v?.currentSavings ?? 0);
    const monthlyContribution = Number(v?.monthlyContribution ?? 0);
    const preReturn = Number(v?.preReturn ?? 0);
    const postReturn = Number(v?.postReturn ?? 0);
    const inflation = Number(v?.inflation ?? 0);

    const yearsToRetire = Math.max(0, retirementAge - currentAge);
    const retirementYears = Math.max(1, lifeExpectancy - retirementAge);

    // 1. Expenses at retirement, in future rupees.
    const expenseAtRetirement =
      monthlyExpense * Math.pow(1 + inflation / 100, yearsToRetire);

    // 2. Corpus needed. Discount with the real return so the withdrawals keep
    //    pace with inflation through retirement.
    const realMonthlyRate =
      (Math.pow(
        (1 + postReturn / 100) / (1 + inflation / 100),
        1 / 12
      ) - 1);
    const months = retirementYears * 12;
    const requiredCorpus =
      Math.abs(realMonthlyRate) < 1e-9
        ? expenseAtRetirement * months
        : expenseAtRetirement *
          ((1 - Math.pow(1 + realMonthlyRate, -months)) / realMonthlyRate);

    // 3. What the plan actually reaches.
    const savingsGrowth =
      currentSavings * Math.pow(1 + preReturn / 100, yearsToRetire);
    const contributionGrowth =
      yearsToRetire > 0
        ? calculateSip(monthlyContribution, preReturn, yearsToRetire).futureValue
        : 0;
    const projectedCorpus = savingsGrowth + contributionGrowth;
    const gap = requiredCorpus - projectedCorpus;

    // Extra monthly saving that would close the gap.
    const additionalMonthly =
      gap > 0 && yearsToRetire > 0
        ? (() => {
            const perRupee = calculateSip(1, preReturn, yearsToRetire).futureValue;
            return perRupee > 0 ? gap / perRupee : 0;
          })()
        : 0;

    return {
      yearsToRetire,
      retirementYears,
      expenseAtRetirement,
      requiredCorpus,
      projectedCorpus,
      savingsGrowth,
      contributionGrowth,
      gap,
      additionalMonthly,
      onTrack: gap <= 0,
      coverage: requiredCorpus > 0 ? (projectedCorpus / requiredCorpus) * 100 : 100,
    };
  });

  // ─────────────────────────────── Chart ───────────────────────────────

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const v = this.values();
    const currentAge = Number(v?.currentAge ?? 0);
    const currentSavings = Number(v?.currentSavings ?? 0);
    const monthlyContribution = Number(v?.monthlyContribution ?? 0);
    const preReturn = Number(v?.preReturn ?? 0);
    const plan = this.plan();

    const labels: string[] = [];
    const projected: number[] = [];
    const target: number[] = [];

    for (let year = 0; year <= plan.yearsToRetire; year++) {
      const savings = currentSavings * Math.pow(1 + preReturn / 100, year);
      const contributions =
        year > 0 ? calculateSip(monthlyContribution, preReturn, year).futureValue : 0;
      labels.push(`Age ${currentAge + year}`);
      projected.push(Math.round(savings + contributions));
      target.push(Math.round(plan.requiredCorpus));
    }

    return {
      labels,
      datasets: [
        {
          label: 'Projected corpus',
          data: projected,
          borderColor: plan.onTrack ? '#16A34A' : '#4F46E5',
          borderWidth: 2.5,
          fill: true,
          backgroundColor: context =>
            this.charts.gradientFill(context, plan.onTrack ? '#16A34A' : '#4F46E5', 0.26),
          pointBackgroundColor: plan.onTrack ? '#16A34A' : '#4F46E5',
        },
        {
          label: 'Corpus needed',
          data: target,
          borderColor: '#DC2626',
          borderWidth: 1.5,
          borderDash: [6, 5],
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
    }),
  }));
}
