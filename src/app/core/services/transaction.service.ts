import { Injectable, computed, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { parse, unparse } from 'papaparse';
import { Transaction } from '../models/transaction.model';
import { CollectionStore } from './collection.store';
import { AuthService } from './auth.service';
import {
  groupByCategory,
  inMonth,
  monthKey,
  netSavings,
  savingsRate,
  totalExpense,
  totalIncome,
} from '../../shared/utils/finance.utils';

/** Filter state driven by the transaction list's filter bar. */
export interface TransactionFilter {
  search: string;
  type: 'all' | 'income' | 'expense';
  categories: string[];
  from: string | null;
  to: string | null;
}

export const EMPTY_FILTER: TransactionFilter = {
  search: '',
  type: 'all',
  categories: [],
  from: null,
  to: null,
};

/** Columns written by the CSV export, and expected by the import. */
const CSV_COLUMNS = [
  'id',
  'type',
  'amount',
  'category',
  'date',
  'paymentMethod',
  'notes',
  'tags',
] as const;

/**
 * Income and expense transactions, plus the derived cash-flow totals the
 * dashboard and analytics pages read.
 */
@Injectable({ providedIn: 'root' })
export class TransactionService extends CollectionStore<Transaction> {
  protected readonly endpoint = '/transactions';
  protected readonly storageKey = 'transactions';

  private readonly auth = inject(AuthService);

  /** Newest first — the order every list in the app shows. */
  readonly sorted = computed(() =>
    [...this.items()].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  );

  readonly totalIncome = computed(() => totalIncome(this.items()));
  readonly totalExpense = computed(() => totalExpense(this.items()));
  readonly netSavings = computed(() => netSavings(this.items()));
  readonly savingsRate = computed(() => savingsRate(this.items()));

  /** Transactions in the current calendar month. */
  readonly thisMonth = computed(() => inMonth(this.items(), monthKey()));

  /** Expense totals per category for the current month, largest first. */
  readonly expenseByCategory = computed(() =>
    groupByCategory(this.thisMonth().filter(t => t.type === 'expense'))
  );

  /** Every category present in the data, for filter chips. */
  readonly usedCategories = computed(() =>
    [...new Set(this.items().map(t => t.category))].sort()
  );

  /** Spend in a category for a `YYYY-MM` month — used by budget progress. */
  spentInCategory(category: string, month: string): number {
    return this.items()
      .filter(
        t =>
          t.type === 'expense' &&
          t.category === category &&
          monthKey(t.date) === month
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /** Applies the filter bar's state to the sorted list. */
  filter(filter: TransactionFilter): Transaction[] {
    const needle = filter.search.trim().toLowerCase();
    const fromTime = filter.from ? new Date(filter.from).getTime() : null;
    const toTime = filter.to ? new Date(filter.to).setHours(23, 59, 59, 999) : null;

    return this.sorted().filter(t => {
      if (filter.type !== 'all' && t.type !== filter.type) return false;
      if (filter.categories.length && !filter.categories.includes(t.category)) {
        return false;
      }
      const time = new Date(t.date).getTime();
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
      if (needle) {
        const haystack = [
          t.category,
          t.notes ?? '',
          t.paymentMethod,
          String(t.amount),
          ...(t.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }

  /** Adds a transaction, stamping the current user. */
  add(draft: Omit<Transaction, 'id' | 'userId'>): Observable<Transaction> {
    return this.create({ ...draft, userId: this.auth.userId() });
  }

  // ─────────────────────────── CSV ───────────────────────────

  /** Serialises the current list to a CSV blob. */
  toCsv(rows: readonly Transaction[] = this.sorted()): Blob {
    const flat = rows.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: t.date,
      paymentMethod: t.paymentMethod,
      notes: t.notes ?? '',
      tags: (t.tags ?? []).join('|'),
    }));
    const csv = unparse(flat, { columns: [...CSV_COLUMNS] });
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Imports transactions from a CSV file.
   *
   * Rows missing an amount, a category or a parseable date are skipped rather
   * than imported as zero-value records; the count of skipped rows is returned
   * so the UI can report it honestly.
   */
  importCsv(file: File): Observable<{ imported: Transaction[]; skipped: number }> {
    return this.readFile(file).pipe(
      switchMap(text => {
        const result = parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        const rows = result.data ?? [];
        const drafts: Omit<Transaction, 'id'>[] = [];
        let skipped = 0;

        for (const row of rows) {
          const draft = this.rowToDraft(row);
          if (draft) drafts.push(draft);
          else skipped++;
        }

        if (drafts.length === 0) return of({ imported: [], skipped });
        return this.createMany(drafts).pipe(
          map(imported => ({ imported, skipped }))
        );
      })
    );
  }

  /** Validates and normalises one CSV row, or null when unusable. */
  private rowToDraft(row: Record<string, string>): Omit<Transaction, 'id'> | null {
    const amount = Number(row['amount']);
    const category = (row['category'] ?? '').trim();
    const rawDate = (row['date'] ?? '').trim();
    const date = new Date(rawDate);

    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (!category) return null;
    if (!rawDate || Number.isNaN(date.getTime())) return null;

    const type = row['type'] === 'income' ? 'income' : 'expense';
    const method = (row['paymentMethod'] ?? '').trim();
    const paymentMethod: Transaction['paymentMethod'] = (
      ['cash', 'upi', 'card', 'bank'] as const
    ).includes(method as Transaction['paymentMethod'])
      ? (method as Transaction['paymentMethod'])
      : 'upi';

    const tags = (row['tags'] ?? '')
      .split(/[|,]/)
      .map(s => s.trim())
      .filter(Boolean);

    return {
      userId: this.auth.userId(),
      type,
      amount,
      category,
      date: date.toISOString().slice(0, 10),
      paymentMethod,
      notes: (row['notes'] ?? '').trim() || undefined,
      tags: tags.length ? tags : undefined,
    };
  }

  private readFile(file: File): Observable<string> {
    return new Observable<string>(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        observer.next(String(reader.result ?? ''));
        observer.complete();
      };
      reader.onerror = () => observer.error(new Error('Could not read the file.'));
      reader.readAsText(file);
      return () => reader.abort();
    });
  }

  // ─────────────────────── Recurring transactions ───────────────────────

  /**
   * Materialises occurrences of recurring transactions that are due up to
   * today but not yet present.
   *
   * A generated copy carries no `recurring` flag (only the template does), and
   * duplicates are detected on category + amount + date, so running this twice
   * does not double up.
   */
  generateRecurring(): Observable<Transaction[]> {
    const all = this.items();
    const templates = all.filter(t => t.recurring);
    if (templates.length === 0) return of([]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingKeys = new Set(
      all.map(t => `${t.category}|${t.amount}|${t.date}`)
    );
    const drafts: Omit<Transaction, 'id'>[] = [];

    for (const template of templates) {
      const recurrence = template.recurring;
      if (!recurrence) continue;
      const endDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
      let cursor = this.advance(new Date(template.date), recurrence.frequency);

      // Cap the walk so a far-past template cannot spin for too long.
      for (let guard = 0; guard < 240; guard++) {
        if (cursor > today) break;
        if (endDate && cursor > endDate) break;

        const date = cursor.toISOString().slice(0, 10);
        const key = `${template.category}|${template.amount}|${date}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          const { id: _id, recurring: _recurring, ...rest } = template;
          drafts.push({ ...rest, date });
        }
        cursor = this.advance(cursor, recurrence.frequency);
      }
    }

    if (drafts.length === 0) return of([]);
    return this.createMany(drafts);
  }

  private advance(
    date: Date,
    frequency: 'weekly' | 'monthly' | 'yearly'
  ): Date {
    const next = new Date(date);
    if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
    return next;
  }
}
