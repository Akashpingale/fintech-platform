import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { unparse } from 'papaparse';
import { Transaction } from '../models/transaction.model';
import { AuthService } from './auth.service';
import { CurrencyService } from './currency.service';
import { HoldingMetrics, ASSET_TYPE_LABELS } from './portfolio.service';
import { BudgetProgress } from './budget.service';
import { GoalProgress } from './goal.service';

/** jspdf-autotable records the last table's end position on the document. */
interface DocWithTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

/** Brand colours reused in the PDF header, as RGB triples. */
const BRAND: [number, number, number] = [79, 70, 229];
const MUTED: [number, number, number] = [100, 116, 139];
const SUCCESS: [number, number, number] = [22, 163, 74];
const DANGER: [number, number, number] = [220, 38, 38];

export interface StatementRange {
  label: string;
  from: Date;
  to: Date;
}

/**
 * PDF and CSV generation for the Reports page.
 *
 * Amounts are written with a plain `Rs.` prefix rather than `₹`: jsPDF's
 * built-in Helvetica has no rupee glyph, so the symbol would render as a blank
 * box. Embedding a Unicode font would add ~400 kB to the bundle for one glyph.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly auth = inject(AuthService);
  private readonly currency = inject(CurrencyService);

  // ─────────────────────────────── CSV ───────────────────────────────

  /** Triggers a browser download of a CSV built from plain rows. */
  downloadCsv(filename: string, rows: readonly Record<string, unknown>[]): void {
    const csv = unparse(rows as Record<string, unknown>[], { header: true });
    this.download(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      this.stamp(filename, 'csv')
    );
  }

  /** Transaction statement as CSV. */
  transactionsCsv(transactions: readonly Transaction[]): void {
    this.downloadCsv(
      'fintrack-transactions',
      transactions.map(t => ({
        Date: t.date,
        Type: t.type,
        Category: t.category,
        Amount: t.amount,
        'Payment method': t.paymentMethod,
        Tags: (t.tags ?? []).join(' | '),
        Notes: t.notes ?? '',
      }))
    );
  }

  /** Portfolio statement as CSV. */
  portfolioCsv(metrics: readonly HoldingMetrics[]): void {
    this.downloadCsv(
      'fintrack-portfolio',
      metrics.map(m => ({
        Symbol: m.holding.symbol,
        Name: m.holding.name,
        'Asset type': ASSET_TYPE_LABELS[m.holding.assetType],
        Quantity: m.holding.quantity,
        'Avg buy price': m.holding.avgBuyPrice,
        'Current price': m.holding.currentPrice,
        Invested: Math.round(m.invested),
        'Current value': Math.round(m.current),
        'P/L': Math.round(m.pl),
        'Return %': m.plPercent.toFixed(2),
      }))
    );
  }

  // ─────────────────────────────── PDF ───────────────────────────────

  /**
   * Income and expense statement for a period, with a summary block and a
   * category breakdown followed by the full transaction table.
   */
  transactionStatementPdf(
    transactions: readonly Transaction[],
    range: StatementRange
  ): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as DocWithTable;
    let y = this.header(doc, 'Income & Expense Statement', range.label);

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    y = this.summaryRow(doc, y, [
      { label: 'Total income', value: this.money(income), tone: SUCCESS },
      { label: 'Total expense', value: this.money(expense), tone: DANGER },
      {
        label: 'Net savings',
        value: this.money(income - expense),
        tone: income - expense >= 0 ? SUCCESS : DANGER,
      },
      {
        label: 'Savings rate',
        value: income > 0 ? `${(((income - expense) / income) * 100).toFixed(1)}%` : '—',
        tone: MUTED,
      },
    ]);

    // Category breakdown.
    const byCategory = new Map<string, number>();
    for (const t of transactions.filter(t => t.type === 'expense')) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }
    const breakdown = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

    if (breakdown.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Expense category', 'Amount', 'Share']],
        body: breakdown.map(([category, total]) => [
          category,
          this.money(total),
          expense > 0 ? `${((total / expense) * 100).toFixed(1)}%` : '—',
        ]),
        ...this.tableStyle(),
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
        },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 24;
    }

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Category', 'Method', 'Amount', 'Notes']],
      body: [...transactions]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(t => [
          t.date,
          t.type === 'income' ? 'Income' : 'Expense',
          t.category,
          t.paymentMethod.toUpperCase(),
          `${t.type === 'income' ? '+' : '-'}${this.money(t.amount)}`,
          t.notes ?? '',
        ]),
      ...this.tableStyle(),
      columnStyles: { 4: { halign: 'right' }, 5: { cellWidth: 120 } },
    });

    this.footer(doc);
    doc.save(this.stamp('fintrack-statement', 'pdf'));
  }

  /** Portfolio holdings statement with totals. */
  portfolioStatementPdf(
    metrics: readonly HoldingMetrics[],
    totals: { invested: number; current: number; pl: number; plPercent: number; xirr: number }
  ): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as DocWithTable;
    let y = this.header(doc, 'Portfolio Statement', this.today());

    y = this.summaryRow(doc, y, [
      { label: 'Invested', value: this.money(totals.invested), tone: MUTED },
      { label: 'Current value', value: this.money(totals.current), tone: BRAND },
      {
        label: 'Profit / Loss',
        value: `${this.money(totals.pl)} (${totals.plPercent.toFixed(2)}%)`,
        tone: totals.pl >= 0 ? SUCCESS : DANGER,
      },
      { label: 'XIRR', value: `${totals.xirr.toFixed(2)}%`, tone: MUTED },
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        ['Symbol', 'Asset type', 'Qty', 'Avg cost', 'Price', 'Invested', 'Value', 'P/L', 'Return'],
      ],
      body: metrics.map(m => [
        m.holding.symbol,
        ASSET_TYPE_LABELS[m.holding.assetType],
        String(m.holding.quantity),
        this.money(m.holding.avgBuyPrice),
        this.money(m.holding.currentPrice),
        this.money(m.invested),
        this.money(m.current),
        this.money(m.pl),
        `${m.plPercent.toFixed(2)}%`,
      ]),
      foot: [
        [
          'Total',
          '',
          '',
          '',
          '',
          this.money(totals.invested),
          this.money(totals.current),
          this.money(totals.pl),
          `${totals.plPercent.toFixed(2)}%`,
        ],
      ],
      ...this.tableStyle(),
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
    });

    this.footer(doc);
    doc.save(this.stamp('fintrack-portfolio', 'pdf'));
  }

  /** Combined budgets-and-goals progress report. */
  planningPdf(
    budgets: readonly BudgetProgress[],
    goals: readonly GoalProgress[],
    monthLabel: string
  ): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as DocWithTable;
    let y = this.header(doc, 'Budgets & Goals Report', monthLabel);

    if (budgets.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Category', 'Limit', 'Spent', 'Remaining', 'Usage', 'Status']],
        body: budgets.map(b => [
          b.budget.category,
          this.money(b.budget.limit),
          this.money(b.spent),
          this.money(b.remaining),
          `${b.usage.toFixed(0)}%`,
          b.status === 'red' ? 'Over' : b.status === 'amber' ? 'Near limit' : 'On track',
        ]),
        ...this.tableStyle(),
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 24;
    }

    if (goals.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Goal', 'Target', 'Saved', 'Progress', 'Monthly needed', 'Deadline', 'Status']],
        body: goals.map(g => [
          g.goal.name,
          this.money(g.goal.targetAmount),
          this.money(g.goal.savedAmount),
          `${g.percent.toFixed(0)}%`,
          this.money(g.monthlyNeeded),
          g.goal.deadline,
          g.status === 'achieved'
            ? 'Achieved'
            : g.status === 'on_track'
              ? 'On track'
              : 'Behind',
        ]),
        ...this.tableStyle(),
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
      });
    }

    this.footer(doc);
    doc.save(this.stamp('fintrack-planning', 'pdf'));
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /** Brand header; returns the y position to continue from. */
  private header(doc: jsPDF, title: string, subtitle: string): number {
    const width = doc.internal.pageSize.getWidth();

    doc.setFillColor(...BRAND);
    doc.rect(0, 0, width, 76, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('FinTrack', 40, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Personal Finance & Investment Platform', 40, 52);

    doc.setFontSize(9);
    const user = this.auth.currentUser();
    if (user) {
      doc.text(`${user.name} · ${user.email}`, width - 40, 34, { align: 'right' });
    }
    doc.text(`Generated ${this.today()}`, width - 40, 52, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, 40, 112);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 40, 130);
    doc.setTextColor(15, 23, 42);

    return 154;
  }

  /** Row of label/value summary boxes; returns the next y position. */
  private summaryRow(
    doc: jsPDF,
    y: number,
    cells: { label: string; value: string; tone: [number, number, number] }[]
  ): number {
    const width = doc.internal.pageSize.getWidth();
    const margin = 40;
    const gap = 10;
    const boxWidth = (width - margin * 2 - gap * (cells.length - 1)) / cells.length;
    const boxHeight = 52;

    cells.forEach((cell, index) => {
      const x = margin + index * (boxWidth + gap);
      doc.setFillColor(243, 245, 250);
      doc.roundedRect(x, y, boxWidth, boxHeight, 6, 6, 'F');

      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(cell.label.toUpperCase(), x + 10, y + 18);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...cell.tone);
      doc.text(cell.value, x + 10, y + 38);
    });

    doc.setTextColor(15, 23, 42);
    return y + boxHeight + 24;
  }

  /** Page numbers and a disclaimer on every page. */
  private footer(doc: jsPDF): void {
    const pages = doc.getNumberOfPages();
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        'Generated by FinTrack from demo data. Not financial advice.',
        40,
        height - 24
      );
      doc.text(`Page ${page} of ${pages}`, width - 40, height - 24, {
        align: 'right',
      });
    }
  }

  private tableStyle() {
    return {
      theme: 'striped' as const,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
      footStyles: { fillColor: [238, 241, 248] as [number, number, number], textColor: [15, 23, 42] as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [248, 250, 253] as [number, number, number] },
      margin: { left: 40, right: 40 },
    };
  }

  /** `Rs. 1,25,000` — see the class comment on why the symbol is spelled out. */
  private money(value: number): string {
    const formatted = this.currency
      .format(value)
      .replace(/[₹$€]/g, '')
      .trim();
    const prefix =
      this.currency.code() === 'INR'
        ? 'Rs. '
        : `${this.currency.meta.code} `;
    return `${prefix}${formatted}`;
  }

  private today(): string {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private stamp(name: string, extension: string): string {
    return `${name}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
