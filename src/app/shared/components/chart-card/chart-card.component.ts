import { Component, input } from '@angular/core';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * Card wrapper around a Chart.js canvas, with the three states every chart
 * needs: loading skeleton, empty placeholder, and the chart itself.
 *
 * Projected content in `[slot=actions]` renders in the card header, which is
 * how pages add range tabs or toggles above a chart.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [BaseChartDirective, EmptyStateComponent, SkeletonComponent],
  template: `
    <section class="card chart-card">
      <header class="chart-card__head">
        <div>
          <h2 class="chart-card__title">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="chart-card__subtitle">{{ subtitle() }}</p>
          }
        </div>
        <div class="chart-card__actions">
          <ng-content select="[slot=actions]" />
        </div>
      </header>

      @if (loading()) {
        <div class="chart-card__body" [style.height.px]="height()">
          <app-skeleton [rows]="1" height="100%" radius="var(--r-md)" />
        </div>
      } @else if (isEmpty()) {
        <div class="chart-card__body" [style.height.px]="height()">
          <app-empty-state
            icon="bar_chart"
            [title]="emptyTitle()"
            [message]="emptyMessage()"
          />
        </div>
      } @else {
        <div class="chart-card__body" [style.height.px]="height()">
          <canvas
            baseChart
            [type]="type()"
            [data]="data()"
            [options]="options()"
            [attr.aria-label]="title() + ' chart'"
            role="img"
          ></canvas>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .chart-card {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .chart-card__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .chart-card__title {
        font-size: var(--fs-h2);
        font-weight: 600;
      }
      .chart-card__subtitle {
        margin: 2px 0 0;
        font-size: var(--fs-caption);
        color: var(--text-muted);
      }
      .chart-card__actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .chart-card__body {
        position: relative;
        display: grid;
        place-items: stretch;
        min-width: 0;
      }
      .chart-card__body app-empty-state {
        place-self: center;
      }
    `,
  ],
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartData>();
  readonly options = input<ChartOptions>({});
  readonly height = input(280);
  readonly loading = input(false);
  readonly emptyTitle = input('Nothing to chart yet');
  readonly emptyMessage = input('Add some data and this chart will fill in.');

  /** Empty when there are no datasets, or every dataset is empty. */
  protected isEmpty(): boolean {
    const datasets = this.data().datasets ?? [];
    if (datasets.length === 0) return true;
    return datasets.every(d => (d.data?.length ?? 0) === 0);
  }
}
