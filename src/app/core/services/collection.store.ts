import { HttpClient } from '@angular/common/http';
import { inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { StorageService } from './storage.service';

/** Anything persisted in a json-server collection. */
export interface Entity {
  id: string;
}

/**
 * Base class for every collection-backed service.
 *
 * Behaviour, applied uniformly:
 *  - json-server is the source of truth when reachable;
 *  - every successful read or write mirrors the list into localStorage, so the
 *    cache is warm and the app still works when the mock API is stopped;
 *  - when a request fails, the operation is applied to the cached list instead
 *    and the caller sees a normal success. This is what makes the demo work
 *    with zero setup (Section 0.3 of the plan).
 *
 * A real backend would not swallow write failures this way — the fallback is
 * deliberate for an offline-capable mock.
 */
export abstract class CollectionStore<T extends Entity> {
  protected readonly http = inject(HttpClient);
  protected readonly storage = inject(StorageService);

  /** Root-relative collection path, e.g. `/transactions`. */
  protected abstract readonly endpoint: string;
  /** localStorage key for the mirrored cache. */
  protected abstract readonly storageKey: string;

  /** The current list. Components read this signal directly. */
  readonly items = signal<T[]>([]);
  readonly loading = signal(false);
  /** True once a load has completed, so templates can tell empty from pending. */
  readonly loaded = signal(false);

  /** Loads the collection; subsequent calls are no-ops unless `force`. */
  load(force = false): Observable<T[]> {
    if (this.loaded() && !force) return of(this.items());

    this.loading.set(true);
    return this.http.get<T[]>(this.endpoint).pipe(
      catchError(() => of(this.cached())),
      tap(list => {
        this.commit(list);
        this.loading.set(false);
        this.loaded.set(true);
      })
    );
  }

  /** One item by id from the loaded list. */
  find(id: string): T | undefined {
    return this.items().find(item => item.id === id);
  }

  /** Creates an item; json-server assigns the id when it is reachable. */
  create(draft: Omit<T, 'id'>): Observable<T> {
    return this.http.post<T>(this.endpoint, draft).pipe(
      catchError(() =>
        of({ ...draft, id: crypto.randomUUID() } as unknown as T)
      ),
      tap(created => this.commit([...this.items(), created]))
    );
  }

  /** Replaces an item wholesale. */
  update(item: T): Observable<T> {
    return this.http.put<T>(`${this.endpoint}/${item.id}`, item).pipe(
      catchError(() => of(item)),
      tap(saved =>
        this.commit(this.items().map(i => (i.id === saved.id ? saved : i)))
      )
    );
  }

  /** Applies a partial change to one item. */
  patch(id: string, changes: Partial<T>): Observable<T> {
    const existing = this.find(id);
    const optimistic = {
      ...(existing ?? ({ id } as unknown as T)),
      ...changes,
    } as unknown as T;
    return this.http.patch<T>(`${this.endpoint}/${id}`, changes).pipe(
      catchError(() => of(optimistic)),
      tap(saved =>
        this.commit(this.items().map(i => (i.id === saved.id ? saved : i)))
      )
    );
  }

  /** Deletes one item. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}`).pipe(
      catchError(() => of(undefined)),
      tap(() => this.commit(this.items().filter(i => i.id !== id))),
      map(() => undefined)
    );
  }

  /** Deletes several items (json-server has no bulk endpoint). */
  removeMany(ids: readonly string[]): Observable<void> {
    if (ids.length === 0) return of(undefined);
    return forkJoin(ids.map(id => this.remove(id))).pipe(map(() => undefined));
  }

  /** Creates several items in one go, returning everything created. */
  createMany(drafts: readonly Omit<T, 'id'>[]): Observable<T[]> {
    if (drafts.length === 0) return of([]);
    return forkJoin(drafts.map(d => this.create(d)));
  }

  /** Replaces the whole collection locally (used by backup restore). */
  replaceAll(list: readonly T[]): void {
    this.commit([...list]);
  }

  /** Writes the list to the signal and mirrors it to localStorage. */
  protected commit(list: readonly T[]): void {
    const next = [...list];
    this.items.set(next);
    this.storage.set(this.storageKey, next);
  }

  protected cached(): T[] {
    return this.storage.get<T[]>(this.storageKey) ?? [];
  }
}
