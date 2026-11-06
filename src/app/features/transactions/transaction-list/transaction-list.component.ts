import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { Transaction } from '../../../core/models/transaction.model';
import {
  EMPTY_FILTER,
  TransactionFilter,
  TransactionService,
} from '../../../core/services/transaction.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  PAYMENT_METHOD_ICONS,
  categoryIcon,
} from '../../../shared/utils/category-icons';

type SortKey = 'date' | 'amount' | 'category' | 'type';

/**
 * Transaction list — Section 3.3.
 * Search, type/category/date filtering, sorting, pagination, row selection
 * with bulk delete, and CSV import/export.
 */
@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatMenuModule,
    EmptyStateComponent,
    SkeletonComponent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
})
export class TransactionListComponent {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly exports = inject(ExportService);
  private readonly charts = inject(ChartThemeService);
  private readonly money = inject(CurrencyService);

  protected readonly transactions = inject(TransactionService);

  protected readonly filter = signal<TransactionFilter>({ ...EMPTY_FILTER });
  protected readonly sortKey = signal<SortKey>('date');
  protected readonly sortDesc = signal(true);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly importing = signal(false);

  protected readonly paymentIcons = PAYMENT_METHOD_ICONS;
  protected readonly loading = computed(() => !this.transactions.loaded());

  /** Categories available as filter chips. */
  protected readonly categories = computed(() =>
    this.transactions.usedCategories()
  );

  /** Filtered rows, before sorting and paging. */
  protected readonly filtered = computed(() =>
    this.transactions.filter(this.filter())
  );

  /** Filtered and sorted rows. */
  protected readonly sorted = computed(() => {
    const key = this.sortKey();
    const direction = this.sortDesc() ? -1 : 1;
    return [...this.filtered()].sort((a, b) => {
      let result = 0;
      switch (key) {
        case 'amount':
          result = a.amount - b.amount;
          break;
        case 'category':
          result = a.category.localeCompare(b.category);
          break;
        case 'type':
          result = a.type.localeCompare(b.type);
          break;
        default:
          result = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return result * direction;
    });
  });

  /** The current page of rows. */
  protected readonly page = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  /** Totals for the filtered set, shown above the table. */
  protected readonly totals = computed(() => {
    const rows = this.filtered();
    const income = rows
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = rows
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, net: income - expense, count: rows.length };
  });

  protected readonly allOnPageSelected = computed(() => {
    const page = this.page();
    if (page.length === 0) return false;
    const selected = this.selected();
    return page.every(t => selected.has(t.id));
  });

  /** Header subtitle: record count and the net figure for the filtered set. */
  protected readonly subtitle = computed(() => {
    const { count, net } = this.totals();
    const label = `${count} record${count === 1 ? '' : 's'}`;
    const sign = net >= 0 ? '+' : '−';
    return `${label} · net ${sign}${this.money.format(Math.abs(net))}`;
  });

  protected readonly hasActiveFilter = computed(() => {
    const f = this.filter();
    return (
      f.search !== '' ||
      f.type !== 'all' ||
      f.categories.length > 0 ||
      f.from !== null ||
      f.to !== null
    );
  });

  // ─────────────────────────── Filtering ───────────────────────────

  protected setSearch(value: string): void {
    this.filter.update(f => ({ ...f, search: value }));
    this.pageIndex.set(0);
  }

  protected setType(type: TransactionFilter['type']): void {
    this.filter.update(f => ({ ...f, type }));
    this.pageIndex.set(0);
  }

  protected toggleCategory(category: string): void {
    this.filter.update(f => ({
      ...f,
      categories: f.categories.includes(category)
        ? f.categories.filter(c => c !== category)
        : [...f.categories, category],
    }));
    this.pageIndex.set(0);
  }

  protected setDate(which: 'from' | 'to', value: string): void {
    this.filter.update(f => ({ ...f, [which]: value || null }));
    this.pageIndex.set(0);
  }

  protected clearFilters(): void {
    this.filter.set({ ...EMPTY_FILTER });
    this.pageIndex.set(0);
  }

  protected isCategoryActive(category: string): boolean {
    return this.filter().categories.includes(category);
  }

  // ─────────────────────────── Sorting & paging ───────────────────────────

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update(d => !d);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key === 'date' || key === 'amount');
    }
  }

  protected sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return 'unfold_more';
    return this.sortDesc() ? 'arrow_downward' : 'arrow_upward';
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.selected.set(new Set());
  }

  // ─────────────────────────── Selection ───────────────────────────

  protected toggleRow(id: string): void {
    this.selected.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected togglePage(): void {
    const page = this.page();
    const allSelected = this.allOnPageSelected();
    this.selected.update(current => {
      const next = new Set(current);
      for (const tx of page) {
        if (allSelected) next.delete(tx.id);
        else next.add(tx.id);
      }
      return next;
    });
  }

  // ─────────────────────────── Actions ───────────────────────────

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }

  protected remove(tx: Transaction): void {
    confirmAction(this.dialog, {
      title: 'Delete this transaction?',
      message: `${tx.category} · ${tx.date}. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.transactions.remove(tx.id).subscribe(() => {
        this.toast.success('Transaction deleted.');
        this.selected.update(current => {
          const next = new Set(current);
          next.delete(tx.id);
          return next;
        });
      });
    });
  }

  protected bulkDelete(): void {
    const ids = [...this.selected()];
    if (ids.length === 0) return;

    confirmAction(this.dialog, {
      title: `Delete ${ids.length} transaction${ids.length > 1 ? 's' : ''}?`,
      message: 'The selected records will be removed permanently.',
      confirmLabel: `Delete ${ids.length}`,
      tone: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.transactions.removeMany(ids).subscribe(() => {
        this.toast.success(`${ids.length} transactions deleted.`);
        this.selected.set(new Set());
      });
    });
  }

  protected exportCsv(): void {
    const rows = this.filtered();
    if (rows.length === 0) {
      this.toast.info('Nothing to export with the current filters.');
      return;
    }
    this.exports.transactionsCsv(rows);
    this.toast.success(`Exported ${rows.length} transactions to CSV.`);
  }

  protected exportPdf(): void {
    const rows = this.filtered();
    if (rows.length === 0) {
      this.toast.info('Nothing to export with the current filters.');
      return;
    }
    const dates = rows.map(t => new Date(t.date).getTime());
    this.exports.transactionStatementPdf(rows, {
      label: this.hasActiveFilter()
        ? `${rows.length} filtered transactions`
        : 'All recorded transactions',
      from: new Date(Math.min(...dates)),
      to: new Date(Math.max(...dates)),
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing.set(true);
    this.transactions.importCsv(file).subscribe({
      next: ({ imported, skipped }) => {
        this.importing.set(false);
        input.value = '';
        if (imported.length === 0) {
          this.toast.error(
            `No rows imported. ${skipped} row${skipped === 1 ? '' : 's'} were missing an amount, category or valid date.`
          );
          return;
        }
        this.toast.success(
          skipped > 0
            ? `Imported ${imported.length} transactions, skipped ${skipped} invalid row${skipped === 1 ? '' : 's'}.`
            : `Imported ${imported.length} transactions.`
        );
      },
      error: (error: Error) => {
        this.importing.set(false);
        input.value = '';
        this.toast.error(error.message || 'Could not import that file.');
      },
    });
  }

  protected generateRecurring(): void {
    this.transactions.generateRecurring().subscribe(created => {
      this.toast.success(
        created.length === 0
          ? 'No recurring entries were due.'
          : `Generated ${created.length} recurring transaction${created.length === 1 ? '' : 's'}.`
      );
    });
  }

  // ─────────────────────────── Presentation ───────────────────────────

  protected iconFor(category: string): string {
    return categoryIcon(category);
  }

  protected colourFor(category: string): string {
    return this.charts.categoryColour(category);
  }
}
