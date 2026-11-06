import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TransactionService, EMPTY_FILTER } from './transaction.service';
import { StorageService } from './storage.service';
import { apiInterceptor } from '../interceptors/api.interceptor';
import { API_BASE_URL } from '../config/api.config';
import { Transaction } from '../models/transaction.model';

const ENDPOINT = `${API_BASE_URL}/transactions`;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 't1',
    userId: 'u1',
    type: partial.type ?? 'expense',
    amount: partial.amount ?? 500,
    category: partial.category ?? 'Food',
    date: partial.date ?? '2026-11-02',
    paymentMethod: partial.paymentMethod ?? 'upi',
    notes: partial.notes,
    tags: partial.tags,
    recurring: partial.recurring,
  };
}

describe('TransactionService', () => {
  let service: TransactionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TransactionService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(StorageService).clear();
  });

  afterEach(() => http.verify());

  it('loads the collection from the mock API through the base-URL interceptor', () => {
    const rows = [tx({ id: 'a' }), tx({ id: 'b', type: 'income', amount: 9000 })];
    service.load().subscribe();

    const request = http.expectOne(ENDPOINT);
    expect(request.request.method).toBe('GET');
    request.flush(rows);

    expect(service.items()).toHaveLength(2);
    expect(service.loaded()).toBe(true);
  });

  it('falls back to the cached list when the API is unreachable', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('transactions', [tx({ id: 'cached', amount: 777 })]);

    service.load().subscribe();
    http.expectOne(ENDPOINT).error(new ProgressEvent('error'), { status: 0 });

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0].amount).toBe(777);
  });

  it('derives income, expense and savings totals', () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([
      tx({ id: 'i', type: 'income', amount: 80000, category: 'Salary' }),
      tx({ id: 'e1', type: 'expense', amount: 20000 }),
      tx({ id: 'e2', type: 'expense', amount: 5000 }),
    ]);

    expect(service.totalIncome()).toBe(80000);
    expect(service.totalExpense()).toBe(25000);
    expect(service.netSavings()).toBe(55000);
    expect(service.savingsRate()).toBeCloseTo(68.75, 6);
  });

  it('appends a created record to the list', () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([]);

    service.create({ ...tx({ id: 'ignored' }) }).subscribe();
    const post = http.expectOne(ENDPOINT);
    expect(post.request.method).toBe('POST');
    post.flush(tx({ id: 'server-id', amount: 1234 }));

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0].id).toBe('server-id');
  });

  it('removes a deleted record from the list', () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([tx({ id: 'a' }), tx({ id: 'b' })]);

    service.remove('a').subscribe();
    http.expectOne(`${ENDPOINT}/a`).flush(null);

    expect(service.items().map(t => t.id)).toEqual(['b']);
  });

  it('sorts newest first', () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([
      tx({ id: 'old', date: '2026-09-01' }),
      tx({ id: 'new', date: '2026-11-05' }),
      tx({ id: 'mid', date: '2026-10-10' }),
    ]);

    expect(service.sorted().map(t => t.id)).toEqual(['new', 'mid', 'old']);
  });

  describe('filtering', () => {
    beforeEach(() => {
      service.load().subscribe();
      http.expectOne(ENDPOINT).flush([
        tx({ id: 'salary', type: 'income', amount: 90000, category: 'Salary', date: '2026-11-01' }),
        tx({ id: 'rent', amount: 22000, category: 'Rent', date: '2026-11-03' }),
        tx({ id: 'coffee', amount: 240, category: 'Food', date: '2026-10-28', notes: 'Flat white' }),
        tx({ id: 'tagged', amount: 900, category: 'Shopping', date: '2026-11-04', tags: ['gift'] }),
      ]);
    });

    it('returns everything with an empty filter', () => {
      expect(service.filter({ ...EMPTY_FILTER })).toHaveLength(4);
    });

    it('filters by type', () => {
      const income = service.filter({ ...EMPTY_FILTER, type: 'income' });
      expect(income.map(t => t.id)).toEqual(['salary']);
    });

    it('filters by category', () => {
      const result = service.filter({
        ...EMPTY_FILTER,
        categories: ['Rent', 'Food'],
      });
      expect(result.map(t => t.id).sort()).toEqual(['coffee', 'rent']);
    });

    it('filters by date range inclusively', () => {
      const result = service.filter({
        ...EMPTY_FILTER,
        from: '2026-11-01',
        to: '2026-11-03',
      });
      expect(result.map(t => t.id).sort()).toEqual(['rent', 'salary']);
    });

    it('searches notes, category, amount and tags', () => {
      expect(service.filter({ ...EMPTY_FILTER, search: 'flat white' })).toHaveLength(1);
      expect(service.filter({ ...EMPTY_FILTER, search: 'gift' })).toHaveLength(1);
      expect(service.filter({ ...EMPTY_FILTER, search: '22000' })).toHaveLength(1);
      expect(service.filter({ ...EMPTY_FILTER, search: 'nothing-here' })).toHaveLength(0);
    });

    it('sums spend per category for a month', () => {
      expect(service.spentInCategory('Rent', '2026-11')).toBe(22000);
      expect(service.spentInCategory('Food', '2026-11')).toBe(0);
      expect(service.spentInCategory('Food', '2026-10')).toBe(240);
    });
  });

  it('exports a CSV blob with a header row', async () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([tx({ id: 'a', amount: 1500, notes: 'Lunch' })]);

    const blob = service.toCsv();
    const text = await blob.text();
    expect(text.split('\n')[0]).toContain('category');
    expect(text).toContain('1500');
    expect(text).toContain('Lunch');
  });

  it('generates no recurring entries when nothing is due', () => {
    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([tx({ id: 'one-off' })]);

    let created: Transaction[] | undefined;
    service.generateRecurring().subscribe(result => (created = result));
    expect(created).toEqual([]);
  });

  it('materialises missing occurrences of a recurring template', () => {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    service.load().subscribe();
    http.expectOne(ENDPOINT).flush([
      tx({
        id: 'rent-template',
        amount: 22000,
        category: 'Rent',
        date: start.toISOString().slice(0, 10),
        recurring: { frequency: 'monthly' },
      }),
    ]);

    service.generateRecurring().subscribe();
    // Three months elapsed, so up to three occurrences are posted.
    const posts = http.match(ENDPOINT);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(posts.length).toBeLessThanOrEqual(4);
    for (const post of posts) {
      expect(post.request.method).toBe('POST');
      // A generated copy must not carry the recurrence flag itself.
      expect((post.request.body as Transaction).recurring).toBeUndefined();
      post.flush({ ...(post.request.body as Transaction), id: crypto.randomUUID() });
    }
  });
});
