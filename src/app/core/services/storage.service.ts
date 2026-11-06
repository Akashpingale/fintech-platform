import { Injectable } from '@angular/core';

/**
 * Local storage service with type-safe get/set.
 * Provides a fallback when json-server is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const val = localStorage.getItem(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Quota exceeded, private browsing, or no storage at all. The app keeps
      // working from its in-memory signals; only the offline cache is lost.
      console.warn(`StorageService: could not persist "${key}".`, error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* No storage available — nothing to remove. */
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch {
      /* No storage available — nothing to clear. */
    }
  }
}
