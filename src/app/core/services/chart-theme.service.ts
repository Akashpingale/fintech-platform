import { Injectable, computed, inject } from '@angular/core';
import {
  Chart,
  ChartOptions,
  ChartType,
  TooltipItem,
  registerables,
} from 'chart.js';
import { ThemeService } from './theme.service';



/** Chart palette from Section 16.3 — used in this order everywhere. */
export const CHART_PALETTE = [
  '#4F46E5',
  '#0D9488',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#EF4444',
] as const;

/** Stable colour per expense/income category so charts agree across pages. */
const CATEGORY_COLOURS: Record<string, string> = {
  Food: '#F59E0B',
  Rent: '#4F46E5',
  Transport: '#3B82F6',
  Shopping: '#EC4899',
  Bills: '#8B5CF6',
  Health: '#10B981',
  Education: '#0D9488',
  Entertainment: '#EF4444',
  Salary: '#16A34A',
  Freelance: '#0D9488',
  Business: '#4F46E5',
  Investment: '#8B5CF6',
  Gift: '#EC4899',
  Other: '#64748B',
};

/**
 * Applies the design-system defaults to Chart.js and exposes theme-aware
 * option builders. Everything reads the live CSS custom properties, so the
 * same code produces correct light and dark charts.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly theme = inject(ThemeService);

  /** Recomputed whenever the theme flips, which re-renders bound charts. */
  readonly tokens = computed(() => {
    // Read the signal so this recomputes on theme change.
    const isDark = this.theme.isDark();
    const css = getComputedStyle(document.body);
    const read = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    return {
      isDark,
      text: read('--text', isDark ? '#E5E9F5' : '#0F172A'),
      textMuted: read('--text-muted', isDark ? '#94A3B8' : '#64748B'),
      border: read('--border', isDark ? '#2A3354' : '#E2E8F0'),
      surface: read('--surface', isDark ? '#141A2E' : '#FFFFFF'),
      success: read('--success', isDark ? '#4ADE80' : '#16A34A'),
      danger: read('--danger', isDark ? '#F87171' : '#DC2626'),
      primary: read('--primary', isDark ? '#818CF8' : '#4F46E5'),
    };
  });

  constructor() {
    this.applyGlobalDefaults();
  }

  /**
   * Section 16.10 — global Chart.js defaults.
   *
   * Registration has to happen first: `Chart.defaults.plugins.legend` and the
   * element defaults only exist once the corresponding plugins and elements are
   * registered. ng2-charts registers them when the first chart renders, which
   * is later than this service is constructed, so we register here as well.
   * `Chart.register` is idempotent.
   */
  private applyGlobalDefaults(): void {
    Chart.register(...registerables);

    Chart.defaults.font.family =
      "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.elements.bar.borderRadius = 8;
    Chart.defaults.elements.line.tension = 0.4;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.elements.point.hoverRadius = 5;
    Chart.defaults.maintainAspectRatio = false;

    // Mutate the animation defaults; do not replace the object.
    // Chart.js `Animations.configure()` copies only the keys that exist on
    // `defaults.animation` into each per-property animation config. Assigning
    // a fresh `{ duration, easing }` object drops `type`, so Chart.js then
    // looks up its interpolator by `typeof from` — there is none for a string
    // or an object — and every animated colour throws
    // "this._fn is not a function" on the first tick.
    if (Chart.defaults.animation) {
      Chart.defaults.animation.duration = 650;
      Chart.defaults.animation.easing = 'easeOutQuart';
    }
  }

  /** Colour for a named category, falling back to the palette by index. */
  categoryColour(category: string, index = 0): string {
    return (
      CATEGORY_COLOURS[category] ?? CHART_PALETTE[index % CHART_PALETTE.length]
    );
  }

  /** Palette slice of `count` colours. */
  palette(count: number): string[] {
    return Array.from(
      { length: count },
      (_, i) => CHART_PALETTE[i % CHART_PALETTE.length]
    );
  }

  /**
   * Themed tooltip for a specific chart type, optionally with a custom label
   * formatter.
   *
   * Generic per chart type because Chart.js types `callbacks.label` against the
   * concrete type; the single internal cast keeps call sites type-safe.
   */
  tooltip<T extends ChartType>(label?: (context: TooltipItem<T>) => string) {
    const t = this.tokens();
    return {
      backgroundColor: t.isDark ? '#1C2340' : '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E9F5',
      borderColor: t.border,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      displayColors: true,
      boxPadding: 4,
      callbacks: label ? { label } : {},
    };
  }

  /** Themed legend; pass `false` to hide it (single-series charts). */
  legend(display = true) {
    return {
      display,
      labels: { color: this.tokens().textMuted },
    };
  }

  /**
   * Cartesian axis styling for bar and line charts.
   *
   * The return type is inferred rather than annotated: Chart.js types its
   * option bags against a concrete chart type, and an annotation using the
   * generic `ChartOptions<T>` cannot be indexed. Returning a plain object lets
   * each call site check it structurally against its own chart type.
   */
  scales(options?: {
    yCallback?: (value: number) => string;
    stacked?: boolean;
    beginAtZero?: boolean;
    showXGrid?: boolean;
  }) {
    const t = this.tokens();
    return {
      x: {
        stacked: options?.stacked ?? false,
        grid: { display: options?.showXGrid ?? false, color: t.border },
        border: { display: false },
        ticks: { color: t.textMuted },
      },
      y: {
        stacked: options?.stacked ?? false,
        beginAtZero: options?.beginAtZero ?? true,
        grid: { color: t.border },
        border: { display: false },
        ticks: {
          color: t.textMuted,
          callback: (value: string | number): string =>
            options?.yCallback ? options.yCallback(Number(value)) : String(value),
        },
      },
    };
  }

  /**
   * Vertical gradient fill for area/line charts, fading the colour to
   * transparent (Section 16.10).
   */
  gradientFill(
    context: { chart: Chart },
    colour: string,
    alpha = 0.25
  ): CanvasGradient | string {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return this.withAlpha(colour, alpha);
    const gradient = ctx.createLinearGradient(
      0,
      chartArea.top,
      0,
      chartArea.bottom
    );
    gradient.addColorStop(0, this.withAlpha(colour, alpha));
    gradient.addColorStop(1, this.withAlpha(colour, 0));
    return gradient;
  }

  /** Hex (`#RRGGBB`) to `rgba()` with the given alpha. */
  withAlpha(colour: string, alpha: number): string {
    const hex = colour.replace('#', '').trim();
    if (hex.length !== 6) return colour;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
